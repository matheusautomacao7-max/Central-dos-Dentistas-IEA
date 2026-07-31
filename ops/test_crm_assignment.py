import sqlite3
import base64
import sys
import tempfile
import types
import gc
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path

if "qrcode" not in sys.modules:
    qrcode = types.ModuleType("qrcode")
    qrcode_image = types.ModuleType("qrcode.image")
    qrcode_svg = types.ModuleType("qrcode.image.svg")
    qrcode_svg.SvgPathImage = object
    qrcode.image = qrcode_image
    sys.modules.update({"qrcode": qrcode, "qrcode.image": qrcode_image, "qrcode.image.svg": qrcode_svg})
if "openpyxl" not in sys.modules:
    openpyxl = types.ModuleType("openpyxl")
    openpyxl.load_workbook = lambda *args, **kwargs: None
    sys.modules["openpyxl"] = openpyxl
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import server


def handler_for(user_id: int, name: str):
    handler = server.ClinicHandler.__new__(server.ClinicHandler)
    handler.authenticated_user = {"id": user_id, "name": name, "access_role": "crc"}
    handler.require_crc_access = lambda: True
    handler.headers = {}
    handler.responses = []
    handler.send_json = lambda payload, status=HTTPStatus.OK: handler.responses.append((int(status), payload))
    return handler


with tempfile.TemporaryDirectory() as directory:
    original_db = server.DB_PATH
    original_media_dir = server.CRM_MEDIA_DIR
    server.DB_PATH = Path(directory) / "clinic.db"
    server.CRM_MEDIA_DIR = Path(directory) / "crm-media"
    try:
        rfc_secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
        assert server.ClinicHandler.totp_code(rfc_secret, 59) == "287082"
        now_epoch = int(server.time.time())
        assert server.ClinicHandler.totp_code(rfc_secret) == server.ClinicHandler.totp_code(rfc_secret, now_epoch)
        sample_epoch = int(datetime(2026, 7, 21, 9, 1, tzinfo=timezone.utc).timestamp())
        assert server.ClinicHandler.evolution_message_time(sample_epoch) == "2026-07-21 05:01:00"
        assert server.ClinicHandler.evolution_message_time("2026-07-21T09:01:00Z") == "2026-07-21 05:01:00"
        with sqlite3.connect(server.DB_PATH) as db:
            db.executescript(Path("app/schema.sql").read_text(encoding="utf-8"))
            db.execute("INSERT INTO users(name,email,access_role,active) VALUES('Isabela','isabela@instituto.local','crc',1)")
            db.execute("INSERT INTO users(name,email,access_role,active) VALUES('Natalia','natalia@instituto.local','crc',1)")
            db.execute("INSERT INTO crm_channels(instance_name,display_name,active,evolution_base_url,evolution_api_key) VALUES('teste','Zero Cárie',1,'https://evolution.test','test-key')")
            db.execute("INSERT INTO crm_contacts(name,phone) VALUES('Paciente Teste','65999999999')")
            db.execute("""INSERT INTO crm_conversations
                (channel_id,contact_id,unread_count,last_direction,last_message_at,queue_entered_at)
                VALUES(1,1,1,'inbound','2026-07-21 09:01:00','2026-07-21 09:01:00')""")
            db.execute("INSERT INTO crm_messages(conversation_id,direction,body,message_at) VALUES(1,'inbound','Teste','2026-07-21 09:01:00')")
            db.execute("INSERT INTO crm_contacts(name,phone) VALUES('HistÃ³rico respondido','65988888888')")
            db.execute("""INSERT INTO crm_conversations
                (channel_id,contact_id,unread_count,last_direction,last_message_at)
                VALUES(1,2,8,'outbound','2026-07-21 09:02:00')""")
            db.execute("INSERT INTO crm_contacts(name,phone) VALUES('Atendimento resolvido','65977777777')")
            db.execute("""INSERT INTO crm_conversations
                (channel_id,contact_id,status,pipeline_stage,unread_count,last_direction,last_message_at,resolved_at,resolved_by_user_id)
                VALUES(1,3,'Resolvida','Resolvido',0,'inbound','2026-07-21 05:01:00','2026-07-21 10:00:00',1)""")
            server.migrate_crm_timezone(db)
            assert db.execute("SELECT message_at FROM crm_messages WHERE id=1").fetchone()[0] == "2026-07-21 05:01:00"
            server.migrate_crm_timezone(db)
            assert db.execute("SELECT message_at FROM crm_messages WHERE id=1").fetchone()[0] == "2026-07-21 05:01:00"

        isabela = handler_for(1, "Isabela")
        isabela.get_crm_conversations({"view": ["active"], "search": ["Paciente Teste"]})
        assert isabela.responses[-1][1]["total"] == 1
        isabela.get_crm_metrics()
        assert isabela.responses[-1][1]["summary"]["waiting"] == 1
        assert isabela.responses[-1][1]["summary"]["active"] == 1
        assert isabela.responses[-1][1]["summary"]["unread"] == 1
        assert isabela.responses[-1][1]["summary"]["unread_messages"] == 1
        isabela.get_crm_conversations({"view": ["queue"]})
        assert isabela.responses[-1][1]["total"] == 1
        assert len(isabela.responses[-1][1]["items"]) == 1
        assert "queue_entered_at" in isabela.responses[-1][1]["items"][0]
        # Ler ou responder pelo WhatsApp externo não retira o contato da fila do CRM.
        with sqlite3.connect(server.DB_PATH) as db:
            db.execute("UPDATE crm_conversations SET unread_count=0,last_direction='outbound' WHERE id=1")
        isabela.get_crm_conversations({"view": ["queue"]})
        assert isabela.responses[-1][1]["total"] == 1
        # Pausar o canal somente no CRM remove sua fila sem desligar a Evolution.
        isabela.update_crm_channel(1, {"sync_enabled": False})
        assert isabela.responses[-1][0] == 200
        isabela.get_crm_conversations({"view": ["queue"]})
        assert isabela.responses[-1][1]["total"] == 0
        isabela.update_crm_channel(1, {"sync_enabled": True, "sync_from_date": "2026-07-20"})
        assert isabela.responses[-1][0] == 200
        # Conversas órfãs de um canal removido não podem inflar o contador
        # nem o total da fila quando não há como exibi-las na interface.
        with sqlite3.connect(server.DB_PATH) as db:
            db.execute("INSERT INTO crm_contacts(name,phone) VALUES('Canal removido','65966666666')")
            db.execute("""INSERT INTO crm_conversations
                (channel_id,contact_id,unread_count,last_direction,last_message_at)
                VALUES(999,4,1,'inbound','2026-07-21 09:04:00')""")
        isabela.get_crm_metrics()
        assert isabela.responses[-1][1]["summary"]["waiting"] == 1
        isabela.get_crm_conversations({"view": ["queue"]})
        assert isabela.responses[-1][1]["total"] == 1
        assert len(isabela.responses[-1][1]["items"]) == 1
        isabela.get_crm_conversations({"view": ["operational"]})
        assert isabela.responses[-1][1]["total"] == 1
        assert server.ClinicHandler.evolution_unread_count({"low": 19}) == 19
        assert server.ClinicHandler.evolution_chat_direction({"lastMessage": {"key": {"fromMe": False}}}) == "inbound"
        assert server.ClinicHandler.evolution_chat_direction({"lastMessage": {"key": {"fromMe": True}}}) == "outbound"

        isabela.update_crm_conversation(1, {"priority": "Alta"})
        assert isabela.responses[-1][0] == 200
        with sqlite3.connect(server.DB_PATH) as db:
            assert db.execute("SELECT priority FROM crm_conversations WHERE id=1").fetchone()[0] == "Alta"
        isabela.claim_crm_conversation(1)
        assert isabela.responses[-1][0] == 200
        assert isabela.responses[-1][1]["claimed"] is True
        with sqlite3.connect(server.DB_PATH) as db:
            claimed = db.execute("SELECT assigned_user_id,pipeline_stage,automation_state FROM crm_conversations WHERE id=1").fetchone()
            assert claimed == (1, "Em atendimento", "paused")
            assignment_events = db.execute("SELECT COUNT(*) FROM crm_conversation_events WHERE conversation_id=1 AND event_type='conversation.assigned'").fetchone()[0]
            assert assignment_events == 1

        # Reabrir a mesma conversa pelo mesmo usuário é idempotente.
        isabela.claim_crm_conversation(1)
        assert isabela.responses[-1][0] == 200
        assert isabela.responses[-1][1]["already_owned"] is True
        with sqlite3.connect(server.DB_PATH) as db:
            assert db.execute("SELECT COUNT(*) FROM crm_conversation_events WHERE conversation_id=1 AND event_type='conversation.assigned'").fetchone()[0] == 1

        with sqlite3.connect(server.DB_PATH) as db:
            db.execute("INSERT INTO crm_messages(conversation_id,external_message_id,direction,body,message_at) VALUES(1,'ia-1','outbound','IA','2026-07-21 05:02:00')")
            db.execute("INSERT INTO crm_messages(conversation_id,external_message_id,direction,body,sent_by_user_id,message_at) VALUES(1,'humano-1','outbound','Humano',1,'2026-07-21 05:03:00')")
        isabela.get_crm_messages(1)
        sent = {item["external_message_id"]: item["sent_by_user_id"] for item in isabela.responses[-1][1]["items"]}
        assert sent["ia-1"] is None and sent["humano-1"] == 1

        with sqlite3.connect(server.DB_PATH) as db:
            db.execute("""INSERT INTO crm_messages
                (conversation_id,external_message_id,direction,message_type,body,media_url,mime_type,message_at)
                VALUES(1,'media-1','inbound','audio','[audio]','https://mmg.whatsapp.net/file.enc','audio/ogg','2026-07-21 05:04:00')""")
            media_message_id = db.execute("SELECT id FROM crm_messages WHERE external_message_id='media-1'").fetchone()[0]
        isabela.get_crm_messages(1)
        media_item = next(item for item in isabela.responses[-1][1]["items"] if item["external_message_id"] == "media-1")
        assert media_item["media_url"] == f"/api/crm/messages/{media_message_id}/media"

        original_evolution_request = isabela.evolution_api_request
        served_media = []
        requested_media = {}
        def fake_media_request(path, method="GET", payload=None, **kwargs):
            requested_media.update(payload or {})
            return {"base64": base64.b64encode(b"decrypted-audio").decode("ascii"),
                    "mimetype": "audio/ogg; codecs=opus", "fileName": "voice.oga"}
        isabela.evolution_api_request = fake_media_request
        isabela.get_crm_media = lambda file_name: served_media.append(file_name)
        isabela.get_crm_message_media(media_message_id)
        assert served_media and served_media[0].endswith(".oga")
        with sqlite3.connect(server.DB_PATH) as db:
            cached_media = db.execute("SELECT media_url,mime_type FROM crm_messages WHERE id=?", (media_message_id,)).fetchone()
            assert cached_media[0] == f"/api/crm/media/{served_media[0]}"
            assert cached_media[1] == "audio/ogg"
        assert (server.CRM_MEDIA_DIR / served_media[0]).read_bytes() == b"decrypted-audio"
        assert requested_media["message"]["key"]["id"] == "media-1"
        assert requested_media["message"]["key"]["remoteJid"] == "65999999999@s.whatsapp.net"
        assert requested_media["message"]["key"]["fromMe"] is False
        isabela.evolution_api_request = original_evolution_request

        original_token = server.INTEGRATION_TOKEN
        server.INTEGRATION_TOKEN = "test-token"
        isabela.mark_crm_ai_message({"external_message_id": "ia-1", "agent_name": "Assistente IEA"}, {"token": ["test-token"]})
        assert isabela.responses[-1][1]["attributed"] is True
        with sqlite3.connect(server.DB_PATH) as db:
            assert db.execute("SELECT author_type,author_label FROM crm_messages WHERE external_message_id='ia-1'").fetchone() == ("ai", "Assistente IEA")
        isabela.get_crm_messages(1, {"after_id": ["1"], "limit": ["20"]})
        assert all(item["id"] > 1 for item in isabela.responses[-1][1]["items"])
        isabela.receive_evolution_webhook({"event": "messages.update", "instance": "teste", "data": {"keyId": "ia-1", "status": "READ"}}, {"token": ["test-token"]})
        with sqlite3.connect(server.DB_PATH) as db:
            assert db.execute("SELECT delivery_status FROM crm_messages WHERE external_message_id='ia-1'").fetchone()[0] == "Read"
        server.INTEGRATION_TOKEN = original_token

        # Iniciar manualmente um contato anteriormente marcado como interno
        # transforma-o em atendimento externo e preserva a atribuiÃ§Ã£o.
        with sqlite3.connect(server.DB_PATH) as db:
            db.execute("INSERT INTO crm_contacts(name,phone,is_internal) VALUES('Contato interno salvo','65911112222',1)")
        isabela.start_crm_conversation({
            "name": "Contato interno salvo", "phone": "(65) 91111-2222",
            "channel_id": 1, "open_only": True,
        })
        assert isabela.responses[-1][0] == 200
        with sqlite3.connect(server.DB_PATH) as db:
            manually_started = db.execute("""SELECT ct.is_internal,cv.assigned_user_id,cv.pipeline_stage
                FROM crm_contacts ct JOIN crm_conversations cv ON cv.contact_id=ct.id
                WHERE ct.phone='65911112222'""").fetchone()
            assert manually_started == (0, 1, "Em atendimento")
            assert db.execute("""SELECT COUNT(*) FROM crm_conversation_events
                WHERE conversation_id=(SELECT cv.id FROM crm_conversations cv JOIN crm_contacts ct ON ct.id=cv.contact_id
                                       WHERE ct.phone='65911112222')
                  AND event_type='conversation.started'""").fetchone()[0] == 1

        natalia = handler_for(2, "Natalia")
        natalia.claim_crm_conversation(1)
        assert natalia.responses[-1][0] == 409

        isabela.get_crm_conversations({"view": ["mine"]})
        assert isabela.responses[-1][1]["total"] == 1
        isabela.resolve_crm_conversation(1)
        assert isabela.responses[-1][1]["resolved"] is True

        with sqlite3.connect(server.DB_PATH) as db:
            row = db.execute("SELECT status,pipeline_stage,assigned_user_id,resolved_by_user_id FROM crm_conversations WHERE id=1").fetchone()
            assert row == ("Resolvida", "Resolvido", 1, 1)
        original_token = server.INTEGRATION_TOKEN
        server.INTEGRATION_TOKEN = "test-token"
        isabela.receive_crm_handoff({"instance": "teste", "phone": "65999999999", "reason": "IA solicitou humano"}, {"token": ["test-token"]})
        assert isabela.responses[-1][1]["queued"] is True
        with sqlite3.connect(server.DB_PATH) as db:
            row = db.execute("SELECT status,pipeline_stage,assigned_user_id,resolved_by_user_id,unread_count,queue_entered_at FROM crm_conversations WHERE id=1").fetchone()
            assert row[:5] == ("Aberta", "Novo", None, None, 1)
            assert row[5]
        isabela.receive_crm_automation_event({
            "event_id": "n8n-ai-1", "event_type": "message.ai.sent", "instance": "teste",
            "phone": "65999999999", "flow_name": "Retorno Zero Carie",
        }, {"token": ["test-token"]})
        assert isabela.responses[-1][1]["conversation_id"] == 1
        with sqlite3.connect(server.DB_PATH) as db:
            assert db.execute("SELECT automation_state,automation_flow,automation_turns FROM crm_conversations WHERE id=1").fetchone() == ("ai_active", "Retorno Zero Carie", 1)
        isabela.receive_crm_automation_event({
            "event_id": "n8n-ai-1", "event_type": "message.ai.sent", "instance": "teste",
            "phone": "65999999999",
        }, {"token": ["test-token"]})
        assert isabela.responses[-1][1]["duplicate"] is True
        with sqlite3.connect(server.DB_PATH) as db:
            assert db.execute("SELECT automation_turns FROM crm_conversations WHERE id=1").fetchone()[0] == 1
        isabela.receive_crm_automation_event({
            "event_id": "n8n-handoff-1", "event_type": "ai.handoff.requested", "instance": "teste",
            "phone": "65999999999", "reason": "Paciente pediu negociação",
        }, {"token": ["test-token"]})
        with sqlite3.connect(server.DB_PATH) as db:
            assert db.execute("SELECT automation_state,handoff_reason FROM crm_conversations WHERE id=1").fetchone() == ("handoff", "Paciente pediu negociação")
        def fake_evolution(path, method="GET", payload=None, **kwargs):
            if path == "/instance/fetchInstances":
                return [{"instance": {"instanceName": "teste", "connectionStatus": "open", "ownerJid": "teste@s.whatsapp.net"}}]
            if path == "/chat/findChats/teste":
                return [
                    {"remoteJid": "123456789012345@lid", "unreadCount": 19,
                     "lastMessage": {"key": {"fromMe": False, "remoteJidAlt": "5565999999999@s.whatsapp.net"}, "messageTimestamp": sample_epoch}},
                    {"remoteJid": "5565988888888@s.whatsapp.net", "unreadCount": 8,
                     "lastMessage": {"key": {"fromMe": True}, "messageTimestamp": sample_epoch}},
                    {"remoteJid": "5565977777777@s.whatsapp.net", "unreadCount": 4,
                     "lastMessage": {"key": {"fromMe": False}, "messageTimestamp": sample_epoch}},
                ]
            raise AssertionError(path)
        isabela.evolution_api_request = fake_evolution
        sync_result = isabela.sync_evolution_chat_state()
        assert sync_result["unread_conversations"] == 2
        assert sync_result["pending_conversations"] == 1
        assert sync_result["unmatched_conversations"] == 0
        isabela.get_crm_metrics()
        assert isabela.responses[-1][1]["summary"]["waiting"] == 1
        assert isabela.responses[-1][1]["summary"]["unread"] == 1
        assert isabela.responses[-1][1]["summary"]["unread_messages"] == 19
        with sqlite3.connect(server.DB_PATH) as db:
            stale = db.execute("SELECT status,unread_count,resolved_at FROM crm_conversations WHERE id=3").fetchone()
            assert stale == ("Resolvida", 0, "2026-07-21 06:00:00")

        class FakeResponse:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self): return b'{"key":{"id":"nova-1"}}'

        original_urlopen = server.urlopen
        server.urlopen = lambda *args, **kwargs: FakeResponse()
        try:
            isabela.start_crm_conversation({
                "name": "Contato Novo", "phone": "(65) 99911-2233", "channel_id": 1,
                "text": "Olá, este é o primeiro contato.",
            })
            assert isabela.responses[-1][0] == 201
            assert isabela.responses[-1][1]["conversation_id"] > 0
            with sqlite3.connect(server.DB_PATH) as db:
                started = db.execute("""SELECT cv.status,cv.pipeline_stage,cv.assigned_user_id,m.author_type,m.author_label
                                      FROM crm_conversations cv JOIN crm_messages m ON m.conversation_id=cv.id
                                      WHERE m.external_message_id='nova-1'""").fetchone()
                assert started == ("Aberta", "Em atendimento", 1, "human", "Isabela")
        finally:
            server.urlopen = original_urlopen

        captured_audio_request = {}
        isabela.send_crm_message(1, {"text": "Resposta sem iniciar"})
        assert isabela.responses[-1][0] == 409
        assert "Inicie o atendimento" in isabela.responses[-1][1]["error"]
        isabela.update_crm_contact(1, {"is_internal": True})
        assert isabela.responses[-1][0] == 200
        assert isabela.responses[-1][1]["is_internal"] is True
        isabela.get_crm_conversations({"view": ["queue"]})
        assert isabela.responses[-1][1]["items"][0]["is_internal"] == 1
        class FakeAudioResponse:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self): return b'{"key":{"id":"audio-1"}}'

        def fake_audio_urlopen(request, **kwargs):
            captured_audio_request["url"] = request.full_url
            captured_audio_request["payload"] = server.json.loads(request.data.decode())
            return FakeAudioResponse()

        original_audio_converter = server.convert_crm_audio_to_ogg
        server.convert_crm_audio_to_ogg = lambda audio: b"OggSconverted-" + audio
        server.urlopen = fake_audio_urlopen
        try:
            with sqlite3.connect(server.DB_PATH) as db:
                db.execute("UPDATE crm_channels SET instance_name='Zero Carie' WHERE id=1")
            isabela.send_crm_message(1, {
                "message_type": "audio",
                "audio_base64": base64.b64encode(b"audio-test").decode("ascii"),
                "mime_type": "audio/webm;codecs=opus",
            })
            assert isabela.responses[-1][0] == 201
            assert captured_audio_request["url"].endswith("/message/sendWhatsAppAudio/Zero%20Carie")
            assert captured_audio_request["payload"]["encoding"] is False
            with sqlite3.connect(server.DB_PATH) as db:
                sent_audio = db.execute("SELECT message_type,media_url,mime_type,author_type FROM crm_messages WHERE external_message_id='audio-1'").fetchone()
                assert sent_audio[0] == "audio" and sent_audio[2:] == ("audio/ogg", "human")
                assert (server.CRM_MEDIA_DIR / Path(sent_audio[1]).name).read_bytes() == b"OggSconverted-audio-test"
        finally:
            server.convert_crm_audio_to_ogg = original_audio_converter
            server.urlopen = original_urlopen

        # Permissoes por numero: uma atendente com escopo ativo somente enxerga,
        # abre, responde e recebe atribuicoes dos canais explicitamente vinculados.
        with sqlite3.connect(server.DB_PATH) as db:
            db.execute("""INSERT INTO crm_channels
                (id,instance_name,display_name,active,sync_enabled,evolution_base_url,evolution_api_key)
                VALUES(10,'orto','Orto',1,1,'https://evolution.test','test-key')""")
            db.execute("INSERT INTO crm_contacts(id,name,phone) VALUES(10,'Paciente Orto','65955555555')")
            db.execute("""INSERT INTO crm_conversations
                (id,channel_id,contact_id,unread_count,last_direction,last_message_at,queue_entered_at)
                VALUES(10,10,10,1,'inbound','2026-07-21 10:00:00','2026-07-21 10:00:00')""")
            db.execute("UPDATE users SET crm_channel_scope_enabled=1 WHERE id=2")
            db.execute("""INSERT INTO crm_user_channels(user_id,channel_id,can_reply,can_manage_automation)
                           VALUES(2,1,1,0)""")

        natalia.responses.clear()
        natalia.get_crm_channels()
        assert [item["id"] for item in natalia.responses[-1][1]["items"]] == [1]
        natalia.get_crm_conversations({"view": ["active"]})
        assert all(item["channel_id"] == 1 for item in natalia.responses[-1][1]["items"])
        natalia.get_crm_messages(10)
        assert natalia.responses[-1][0] == 403
        natalia.update_crm_conversation(10, {"assigned_user_id": "me"})
        assert natalia.responses[-1][0] == 403

        # Permissoes por tela: Natalia recebe apenas Inbox e Filas; Isabela,
        # sem escopo personalizado, preserva acesso a todas as telas.
        with sqlite3.connect(server.DB_PATH) as db:
            db.execute("UPDATE users SET crm_feature_scope_enabled=1 WHERE id=2")
            db.executemany("INSERT INTO crm_user_features(user_id,feature_key) VALUES(2,?)", [("inbox",), ("queue",)])
        natalia.get_crm_permissions()
        assert natalia.responses[-1][1]["allowed_features"] == ["inbox", "queue"]
        assert natalia.crm_feature_allowed("integrations") is False
        assert natalia.crm_feature_allowed("inbox") is True
        isabela.get_crm_permissions()
        assert set(isabela.responses[-1][1]["allowed_features"]) == {"inbox","queue","funnel","management","contacts","campaigns","integrations","settings"}

        # Isabela continua sem escopo restrito e enxerga os dois canais. Ao
        # tentar transferir Orto para Natalia, o backend rejeita a atribuicao.
        isabela.get_crm_channels()
        assert {item["id"] for item in isabela.responses[-1][1]["items"]} == {1, 10}
        isabela.update_crm_conversation(10, {"assigned_user_id": 2})
        assert isabela.responses[-1][0] == 409
        assert "n\u00e3o possui acesso" in isabela.responses[-1][1]["error"]
        server.INTEGRATION_TOKEN = original_token
        print("crm-assignment-tests-ok")
    finally:
        server.DB_PATH = original_db
        server.CRM_MEDIA_DIR = original_media_dir
        del db, isabela, natalia
        gc.collect()
