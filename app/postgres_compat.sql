DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_collation WHERE collname = 'nocase') THEN
        CREATE COLLATION nocase (provider = icu, locale = 'und-u-ks-level2', deterministic = false);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION datetime(value text, VARIADIC modifiers text[] DEFAULT ARRAY[]::text[])
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    result timestamp without time zone;
    modifier text;
    amount numeric;
BEGIN
    IF value IS NULL THEN
        RETURN NULL;
    END IF;
    IF lower(value) = 'now' THEN
        result := CURRENT_TIMESTAMP AT TIME ZONE 'America/Cuiaba';
    ELSE
        result := value::timestamp;
    END IF;
    FOREACH modifier IN ARRAY modifiers LOOP
        IF lower(modifier) = 'localtime' THEN
            CONTINUE;
        ELSIF modifier ~ '^[+-][0-9]+(\.[0-9]+)? (second|seconds|minute|minutes|hour|hours|day|days)$' THEN
            amount := split_part(modifier, ' ', 1)::numeric;
            result := result + (amount * ('1 ' || split_part(modifier, ' ', 2))::interval);
        END IF;
    END LOOP;
    RETURN to_char(result, 'YYYY-MM-DD HH24:MI:SS');
END;
$$;

-- Assinatura antiga (2 args fixos) não suportava múltiplos modificadores
-- (ex.: date('now','localtime','-6 days')); removida em favor da variádica
-- abaixo, que aceita 0, 1 ou N modificadores como datetime() já fazia.
DROP FUNCTION IF EXISTS date(text, text);
CREATE OR REPLACE FUNCTION date(value text, VARIADIC modifiers text[] DEFAULT ARRAY[]::text[])
RETURNS date
LANGUAGE sql
STABLE
AS $$
    SELECT substr(datetime(value, VARIADIC modifiers), 1, 10)::date
$$;

CREATE OR REPLACE FUNCTION julianday(value text, VARIADIC modifiers text[] DEFAULT ARRAY[]::text[])
RETURNS double precision
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    normalized text;
BEGIN
    normalized := datetime(value, VARIADIC modifiers);
    IF normalized IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN extract(epoch FROM normalized::timestamp AT TIME ZONE 'America/Cuiaba') / 86400.0 + 2440587.5;
END;
$$;

CREATE OR REPLACE FUNCTION strftime(format_string text, value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    postgres_format text;
BEGIN
    IF value IS NULL THEN
        RETURN NULL;
    END IF;
    postgres_format := replace(format_string, '%Y', 'YYYY');
    postgres_format := replace(postgres_format, '%m', 'MM');
    postgres_format := replace(postgres_format, '%d', 'DD');
    postgres_format := replace(postgres_format, '%H', 'HH24');
    postgres_format := replace(postgres_format, '%M', 'MI');
    postgres_format := replace(postgres_format, '%S', 'SS');
    RETURN to_char(value::timestamp, postgres_format);
END;
$$;

CREATE OR REPLACE FUNCTION group_concat_step(state text, value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE WHEN value IS NULL THEN state
                WHEN state IS NULL OR state = '' THEN value
                ELSE state || ',' || value END
$$;

DROP AGGREGATE IF EXISTS group_concat(text);
CREATE AGGREGATE group_concat(text) (
    SFUNC = group_concat_step,
    STYPE = text
);

CREATE OR REPLACE FUNCTION group_concat_step_delimited(state text, value text, delimiter text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE WHEN value IS NULL THEN state
                WHEN state IS NULL OR state = '' THEN value
                ELSE state || COALESCE(delimiter, ',') || value END
$$;

DROP AGGREGATE IF EXISTS group_concat(text, text);
CREATE AGGREGATE group_concat(text, text) (
    SFUNC = group_concat_step_delimited,
    STYPE = text
);

-- SQLite accepts ROUND(real, digits). PostgreSQL requires numeric for this
-- two-argument overload, so keep legacy queries compatible during the cutover.
CREATE OR REPLACE FUNCTION round(value double precision, digits integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT pg_catalog.round(value::numeric, digits)
$$;
