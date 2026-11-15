--
-- PostgreSQL database dump
--

\restrict 4RVWZYzU1JLfcVIwc8dC7dK1isg7hE1j5T65E060pL2nrN6cWDKQ1W5Klhcnaus

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg12+2)
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: application_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.application_status AS ENUM (
    'submitted',
    'under_review',
    'interview_scheduled',
    'approved',
    'rejected'
);


--
-- Name: time_log_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.time_log_status AS ENUM (
    'open',
    'pending_verification',
    'verified',
    'rejected'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'applicant',
    'recipient',
    'supervisor',
    'admin'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: announcement_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_attachments (
    id bigint NOT NULL,
    announcement_id bigint NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(255) NOT NULL,
    mime_type character varying(150) NOT NULL,
    file_size bigint NOT NULL,
    is_image boolean DEFAULT false NOT NULL,
    "position" smallint DEFAULT '0'::smallint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: announcement_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcement_attachments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcement_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.announcement_attachments_id_seq OWNED BY public.announcement_attachments.id;


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id bigint NOT NULL,
    title character varying(150) NOT NULL,
    message text NOT NULL,
    sent_by bigint,
    recipient_count integer DEFAULT 0 NOT NULL,
    emailed_count integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    audience character varying(20) DEFAULT 'recipients'::character varying NOT NULL,
    office_id bigint
);


--
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;


--
-- Name: application_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_documents (
    id bigint NOT NULL,
    application_id bigint NOT NULL,
    document_type character varying(100) NOT NULL,
    file_url character varying(255) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_size bigint,
    mime_type character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    file_path character varying(255)
);


--
-- Name: application_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.application_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: application_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.application_documents_id_seq OWNED BY public.application_documents.id;


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    academic_year character varying(20) NOT NULL,
    semester character varying(20) NOT NULL,
    remarks text,
    reviewed_by bigint,
    reviewed_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    status public.application_status DEFAULT 'submitted'::public.application_status NOT NULL,
    type character varying(20) DEFAULT 'new'::character varying NOT NULL
);


--
-- Name: applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.applications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.applications_id_seq OWNED BY public.applications.id;


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    office_id bigint NOT NULL,
    supervisor_id bigint NOT NULL,
    academic_year character varying(20) NOT NULL,
    semester character varying(20) NOT NULL,
    required_hours smallint DEFAULT 200 NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    qr_code text,
    qr_secret character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    pending_required_hours smallint,
    pending_required_by bigint,
    term_status character varying(20),
    deficient_hours numeric(8,2),
    term_status_at timestamp(0) without time zone,
    term_status_by bigint,
    term_status_reason text,
    carried_over_hours integer DEFAULT 0 NOT NULL,
    carried_from_assignment_id bigint,
    report_due_hours_at timestamp(0) without time zone,
    report_due_ended_at timestamp(0) without time zone
);


--
-- Name: assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assignments_id_seq OWNED BY public.assignments.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    user_id bigint,
    action character varying(60) NOT NULL,
    auditable_type character varying(255) NOT NULL,
    auditable_id bigint NOT NULL,
    old_values json,
    new_values json,
    ip_address character varying(45),
    user_agent character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    subject_user_id bigint
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    expiration integer NOT NULL
);


--
-- Name: cache_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache_locks (
    key character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    expiration integer NOT NULL
);


--
-- Name: concern_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concern_messages (
    id bigint NOT NULL,
    concern_id bigint NOT NULL,
    user_id bigint,
    from_staff boolean DEFAULT false NOT NULL,
    body text NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: concern_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.concern_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: concern_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.concern_messages_id_seq OWNED BY public.concern_messages.id;


--
-- Name: concerns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concerns (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    subject character varying(255) NOT NULL,
    message text NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    response text,
    responded_by bigint,
    responded_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: concerns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.concerns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: concerns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.concerns_id_seq OWNED BY public.concerns.id;


--
-- Name: failed_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.failed_jobs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.failed_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.failed_jobs_id_seq OWNED BY public.failed_jobs.id;


--
-- Name: faq_knowledge_base; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faq_knowledge_base (
    id bigint NOT NULL,
    category character varying(60) NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    keywords json,
    is_active boolean DEFAULT true NOT NULL,
    sort_order smallint DEFAULT '0'::smallint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: faq_knowledge_base_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.faq_knowledge_base_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: faq_knowledge_base_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.faq_knowledge_base_id_seq OWNED BY public.faq_knowledge_base.id;


--
-- Name: interviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interviews (
    id bigint NOT NULL,
    application_id bigint NOT NULL,
    scheduled_at timestamp(0) without time zone NOT NULL,
    location character varying(255),
    mode character varying(20) DEFAULT 'in_person'::character varying NOT NULL,
    notes text,
    status character varying(30) DEFAULT 'scheduled'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    meeting_link character varying(500),
    duration_minutes smallint DEFAULT '30'::smallint NOT NULL
);


--
-- Name: interviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.interviews_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: interviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.interviews_id_seq OWNED BY public.interviews.id;


--
-- Name: job_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_batches (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    total_jobs integer NOT NULL,
    pending_jobs integer NOT NULL,
    failed_jobs integer NOT NULL,
    failed_job_ids text NOT NULL,
    options text,
    cancelled_at integer,
    created_at integer NOT NULL,
    finished_at integer
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id bigint NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
);


--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;


--
-- Name: landing_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.landing_photos (
    id bigint NOT NULL,
    caption character varying(160) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    bundled_path character varying(255),
    image_base64 text,
    mime_type character varying(40),
    width integer,
    height integer,
    byte_size integer,
    uploaded_by bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: landing_photos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.landing_photos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: landing_photos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.landing_photos_id_seq OWNED BY public.landing_photos.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: monthly_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_reports (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    assignment_id bigint NOT NULL,
    academic_year character varying(20) NOT NULL,
    semester character varying(20) NOT NULL,
    month smallint NOT NULL,
    year smallint NOT NULL,
    total_hours numeric(7,2) DEFAULT '0'::numeric NOT NULL,
    verified_hours numeric(7,2) DEFAULT '0'::numeric NOT NULL,
    days_present smallint DEFAULT '0'::smallint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: monthly_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.monthly_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: monthly_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.monthly_reports_id_seq OWNED BY public.monthly_reports.id;


--
-- Name: narrative_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.narrative_reports (
    id bigint NOT NULL,
    time_log_id bigint NOT NULL,
    content text NOT NULL,
    activities_done text,
    challenges text,
    submitted_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: narrative_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.narrative_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: narrative_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.narrative_reports_id_seq OWNED BY public.narrative_reports.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    type character varying(255) NOT NULL,
    notifiable_type character varying(255) NOT NULL,
    notifiable_id bigint NOT NULL,
    data json NOT NULL,
    read_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: offices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offices (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    head_name character varying(255),
    location character varying(255),
    max_recipients smallint DEFAULT '5'::smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    latitude numeric(10,8),
    longitude numeric(11,8),
    radius_meters smallint DEFAULT '100'::smallint NOT NULL,
    geofence_enabled boolean DEFAULT false NOT NULL,
    qr_code text,
    qr_secret character varying(255),
    logo_path character varying(255),
    auto_clock_out boolean DEFAULT true NOT NULL
);


--
-- Name: offices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.offices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: offices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.offices_id_seq OWNED BY public.offices.id;


--
-- Name: one_time_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.one_time_codes (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    purpose character varying(20) NOT NULL,
    code_hash character varying(64) NOT NULL,
    attempts smallint DEFAULT '0'::smallint NOT NULL,
    expires_at timestamp(0) without time zone NOT NULL,
    consumed_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: one_time_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.one_time_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: one_time_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.one_time_codes_id_seq OWNED BY public.one_time_codes.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    created_at timestamp(0) without time zone
);


--
-- Name: pending_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_registrations (
    id bigint NOT NULL,
    email character varying(255) NOT NULL,
    student_id_number character varying(255) NOT NULL,
    payload text NOT NULL,
    code_hash character varying(64),
    attempts smallint DEFAULT '0'::smallint NOT NULL,
    code_expires_at timestamp(0) without time zone,
    last_sent_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: pending_registrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pending_registrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pending_registrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pending_registrations_id_seq OWNED BY public.pending_registrations.id;


--
-- Name: personal_access_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal_access_tokens (
    id bigint NOT NULL,
    tokenable_type character varying(255) NOT NULL,
    tokenable_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    token character varying(64) NOT NULL,
    abilities text,
    last_used_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    ip_address character varying(45),
    user_agent text
);


--
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.personal_access_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: personal_access_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.personal_access_tokens_id_seq OWNED BY public.personal_access_tokens.id;


--
-- Name: promissory_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promissory_notes (
    id bigint NOT NULL,
    assignment_id bigint NOT NULL,
    user_id bigint NOT NULL,
    academic_year character varying(20) NOT NULL,
    semester character varying(20) NOT NULL,
    verified_hours_snapshot numeric(8,2) NOT NULL,
    lacking_hours numeric(8,2),
    file_path character varying(255) NOT NULL,
    file_name character varying(255) NOT NULL,
    mime_type character varying(100),
    file_size bigint,
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by bigint,
    reviewed_at timestamp(0) without time zone,
    review_remarks text,
    makeup_deadline date,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deficient_hours numeric(8,2)
);


--
-- Name: promissory_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promissory_notes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promissory_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promissory_notes_id_seq OWNED BY public.promissory_notes.id;


--
-- Name: semester_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.semester_periods (
    id bigint NOT NULL,
    academic_year character varying(20) NOT NULL,
    semester character varying(20) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    renewal_open boolean DEFAULT false NOT NULL,
    closed_at timestamp(0) without time zone,
    created_by bigint,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    renewal_closed_at timestamp(0) without time zone
);


--
-- Name: semester_periods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.semester_periods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: semester_periods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.semester_periods_id_seq OWNED BY public.semester_periods.id;


--
-- Name: semester_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.semester_reports (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    assignment_id bigint NOT NULL,
    academic_year character varying(20) NOT NULL,
    semester character varying(20) NOT NULL,
    required_hours numeric(7,2) DEFAULT 200 NOT NULL,
    verified_hours numeric(7,2) DEFAULT '0'::numeric NOT NULL,
    rendered_hours numeric(7,2) DEFAULT '0'::numeric NOT NULL,
    rejected_hours numeric(7,2) DEFAULT '0'::numeric NOT NULL,
    total_days_present smallint DEFAULT '0'::smallint NOT NULL,
    final_status character varying(20) DEFAULT 'ongoing'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    completion_rate numeric(6,2) GENERATED ALWAYS AS (round(((verified_hours / NULLIF(required_hours, (0)::numeric)) * (100)::numeric), 2)) STORED
);


--
-- Name: semester_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.semester_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: semester_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.semester_reports_id_seq OWNED BY public.semester_reports.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id bigint NOT NULL,
    key character varying(255) NOT NULL,
    value text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.settings_id_seq OWNED BY public.settings.id;


--
-- Name: staff_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_invitations (
    id bigint NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255),
    role character varying(255) NOT NULL,
    office_id bigint,
    token character varying(64) NOT NULL,
    invited_by bigint,
    expires_at timestamp(0) without time zone NOT NULL,
    accepted_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: staff_invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_invitations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_invitations_id_seq OWNED BY public.staff_invitations.id;


--
-- Name: stipend_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stipend_history (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    amount numeric(10,2) NOT NULL,
    academic_year character varying(20) NOT NULL,
    semester character varying(20) NOT NULL,
    period_label character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    released_by bigint,
    released_at timestamp(0) without time zone,
    remarks text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    control_number character varying(255),
    claim_token character varying(255),
    certified_by bigint,
    certified_at timestamp(0) without time zone,
    claimed_at timestamp(0) without time zone,
    receipt_signed_at timestamp(0) without time zone,
    releasing_officer_name character varying(255),
    slip_path character varying(255),
    voided_at timestamp(0) without time zone,
    void_reason character varying(255),
    via_promissory boolean DEFAULT false NOT NULL,
    promissory_note_id bigint,
    required_hours numeric(8,2),
    deficient_hours numeric(8,2),
    lacking_hours numeric(8,2),
    makeup_deadline date,
    received_at timestamp(0) without time zone
);


--
-- Name: stipend_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stipend_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stipend_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stipend_history_id_seq OWNED BY public.stipend_history.id;


--
-- Name: stipend_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stipend_signatures (
    id bigint NOT NULL,
    stipend_history_id bigint NOT NULL,
    signatory_role character varying(32) NOT NULL,
    user_id bigint,
    printed_name character varying(255) NOT NULL,
    method character varying(20) DEFAULT 'authenticated'::character varying NOT NULL,
    signature_image_path character varying(255),
    signed_at timestamp(0) without time zone NOT NULL,
    remarks text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: stipend_signatures_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stipend_signatures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stipend_signatures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stipend_signatures_id_seq OWNED BY public.stipend_signatures.id;


--
-- Name: student_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_profiles (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    student_id_number character varying(255) NOT NULL,
    first_name character varying(255) NOT NULL,
    middle_name character varying(255),
    last_name character varying(255) NOT NULL,
    date_of_birth date,
    gender character varying(10),
    contact_number character varying(20),
    address text,
    college character varying(255) NOT NULL,
    program character varying(255) NOT NULL,
    year_level smallint NOT NULL,
    gpa numeric(4,2),
    photo_url character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: student_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.student_profiles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: student_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.student_profiles_id_seq OWNED BY public.student_profiles.id;


--
-- Name: term_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.term_evaluations (
    id bigint NOT NULL,
    assignment_id bigint NOT NULL,
    evaluator_id bigint,
    rating smallint NOT NULL,
    remarks text NOT NULL,
    passed boolean NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: term_evaluations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.term_evaluations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: term_evaluations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.term_evaluations_id_seq OWNED BY public.term_evaluations.id;


--
-- Name: term_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.term_reports (
    id bigint NOT NULL,
    assignment_id bigint NOT NULL,
    user_id bigint NOT NULL,
    content text,
    accomplishments text,
    challenges text,
    submitted_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    reviewed_at timestamp(0) without time zone,
    reviewed_by bigint,
    renewal_eligible boolean,
    review_remarks text,
    file_path character varying(255),
    file_name character varying(255),
    mime_type character varying(120),
    file_size integer
);


--
-- Name: term_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.term_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: term_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.term_reports_id_seq OWNED BY public.term_reports.id;


--
-- Name: testing_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.testing_snapshots (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    taken_at timestamp(0) without time zone NOT NULL,
    data json NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: testing_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.testing_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: testing_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.testing_snapshots_id_seq OWNED BY public.testing_snapshots.id;


--
-- Name: time_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_logs (
    id bigint NOT NULL,
    assignment_id bigint NOT NULL,
    user_id bigint NOT NULL,
    date date NOT NULL,
    time_in timestamp(0) without time zone NOT NULL,
    time_out timestamp(0) without time zone,
    verified_by bigint,
    verified_at timestamp(0) without time zone,
    rejection_reason text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    status public.time_log_status DEFAULT 'open'::public.time_log_status NOT NULL,
    duration_hours numeric(6,2) GENERATED ALWAYS AS (round((EXTRACT(epoch FROM (time_out - time_in)) / (3600)::numeric), 2)) STORED,
    clocked_out_reason character varying(20),
    time_in_lat numeric(10,8),
    time_in_lng numeric(11,8),
    time_out_lat numeric(10,8),
    time_out_lng numeric(11,8),
    time_in_accuracy numeric(8,2),
    time_out_accuracy numeric(8,2),
    location_flagged boolean DEFAULT false NOT NULL,
    is_manual boolean DEFAULT false NOT NULL,
    manual_reason character varying(255),
    recorded_by bigint,
    time_in_photo_path character varying(255),
    location_flag_reason character varying(255),
    selfie_required boolean
);


--
-- Name: time_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.time_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: time_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.time_logs_id_seq OWNED BY public.time_logs.id;


--
-- Name: trusted_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trusted_devices (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    token_hash character varying(64) NOT NULL,
    user_agent text,
    ip_address character varying(45),
    last_used_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: trusted_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.trusted_devices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trusted_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.trusted_devices_id_seq OWNED BY public.trusted_devices.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password character varying(255) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    role public.user_role DEFAULT 'applicant'::public.user_role NOT NULL,
    office_id bigint,
    avatar_path character varying(255),
    require_clock_in_selfie boolean DEFAULT true NOT NULL,
    signature_image_path character varying(255),
    position_title character varying(150),
    employee_id character varying(20),
    testing_added_at timestamp(0) without time zone,
    testing_email_muted boolean DEFAULT true NOT NULL,
    privacy_accepted_at timestamp(0) without time zone,
    privacy_version character varying(20)
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verifications (
    id bigint NOT NULL,
    time_log_id bigint NOT NULL,
    verified_by bigint NOT NULL,
    action character varying(20) NOT NULL,
    feedback text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.verifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.verifications_id_seq OWNED BY public.verifications.id;


--
-- Name: weekly_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_reports (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    assignment_id bigint NOT NULL,
    academic_year character varying(20) NOT NULL,
    semester character varying(20) NOT NULL,
    week_number smallint NOT NULL,
    week_start date NOT NULL,
    week_end date NOT NULL,
    total_hours numeric(6,2) DEFAULT '0'::numeric NOT NULL,
    verified_hours numeric(6,2) DEFAULT '0'::numeric NOT NULL,
    days_present smallint DEFAULT '0'::smallint NOT NULL,
    log_ids json,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: weekly_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weekly_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weekly_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weekly_reports_id_seq OWNED BY public.weekly_reports.id;


--
-- Name: announcement_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_attachments ALTER COLUMN id SET DEFAULT nextval('public.announcement_attachments_id_seq'::regclass);


--
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- Name: application_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_documents ALTER COLUMN id SET DEFAULT nextval('public.application_documents_id_seq'::regclass);


--
-- Name: applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications ALTER COLUMN id SET DEFAULT nextval('public.applications_id_seq'::regclass);


--
-- Name: assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments ALTER COLUMN id SET DEFAULT nextval('public.assignments_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: concern_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concern_messages ALTER COLUMN id SET DEFAULT nextval('public.concern_messages_id_seq'::regclass);


--
-- Name: concerns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concerns ALTER COLUMN id SET DEFAULT nextval('public.concerns_id_seq'::regclass);


--
-- Name: failed_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs ALTER COLUMN id SET DEFAULT nextval('public.failed_jobs_id_seq'::regclass);


--
-- Name: faq_knowledge_base id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_knowledge_base ALTER COLUMN id SET DEFAULT nextval('public.faq_knowledge_base_id_seq'::regclass);


--
-- Name: interviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews ALTER COLUMN id SET DEFAULT nextval('public.interviews_id_seq'::regclass);


--
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);


--
-- Name: landing_photos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_photos ALTER COLUMN id SET DEFAULT nextval('public.landing_photos_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: monthly_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_reports ALTER COLUMN id SET DEFAULT nextval('public.monthly_reports_id_seq'::regclass);


--
-- Name: narrative_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.narrative_reports ALTER COLUMN id SET DEFAULT nextval('public.narrative_reports_id_seq'::regclass);


--
-- Name: offices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offices ALTER COLUMN id SET DEFAULT nextval('public.offices_id_seq'::regclass);


--
-- Name: one_time_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.one_time_codes ALTER COLUMN id SET DEFAULT nextval('public.one_time_codes_id_seq'::regclass);


--
-- Name: pending_registrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_registrations ALTER COLUMN id SET DEFAULT nextval('public.pending_registrations_id_seq'::regclass);


--
-- Name: personal_access_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens ALTER COLUMN id SET DEFAULT nextval('public.personal_access_tokens_id_seq'::regclass);


--
-- Name: promissory_notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promissory_notes ALTER COLUMN id SET DEFAULT nextval('public.promissory_notes_id_seq'::regclass);


--
-- Name: semester_periods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semester_periods ALTER COLUMN id SET DEFAULT nextval('public.semester_periods_id_seq'::regclass);


--
-- Name: semester_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semester_reports ALTER COLUMN id SET DEFAULT nextval('public.semester_reports_id_seq'::regclass);


--
-- Name: settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings ALTER COLUMN id SET DEFAULT nextval('public.settings_id_seq'::regclass);


--
-- Name: staff_invitations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invitations ALTER COLUMN id SET DEFAULT nextval('public.staff_invitations_id_seq'::regclass);


--
-- Name: stipend_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stipend_history ALTER COLUMN id SET DEFAULT nextval('public.stipend_history_id_seq'::regclass);


--
-- Name: stipend_signatures id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stipend_signatures ALTER COLUMN id SET DEFAULT nextval('public.stipend_signatures_id_seq'::regclass);


--
-- Name: student_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profiles ALTER COLUMN id SET DEFAULT nextval('public.student_profiles_id_seq'::regclass);


--
-- Name: term_evaluations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.term_evaluations ALTER COLUMN id SET DEFAULT nextval('public.term_evaluations_id_seq'::regclass);


--
-- Name: term_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.term_reports ALTER COLUMN id SET DEFAULT nextval('public.term_reports_id_seq'::regclass);


--
-- Name: testing_snapshots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testing_snapshots ALTER COLUMN id SET DEFAULT nextval('public.testing_snapshots_id_seq'::regclass);


--
-- Name: time_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_logs ALTER COLUMN id SET DEFAULT nextval('public.time_logs_id_seq'::regclass);


--
-- Name: trusted_devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices ALTER COLUMN id SET DEFAULT nextval('public.trusted_devices_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: verifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications ALTER COLUMN id SET DEFAULT nextval('public.verifications_id_seq'::regclass);


--
-- Name: weekly_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_reports ALTER COLUMN id SET DEFAULT nextval('public.weekly_reports_id_seq'::regclass);


--
-- Name: announcement_attachments announcement_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_attachments
    ADD CONSTRAINT announcement_attachments_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: application_documents application_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_documents
    ADD CONSTRAINT application_documents_pkey PRIMARY KEY (id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: assignments assignments_qr_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_qr_code_unique UNIQUE (qr_code);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cache_locks cache_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache_locks
    ADD CONSTRAINT cache_locks_pkey PRIMARY KEY (key);


--
-- Name: cache cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (key);


--
-- Name: concern_messages concern_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concern_messages
    ADD CONSTRAINT concern_messages_pkey PRIMARY KEY (id);


--
-- Name: concerns concerns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concerns
    ADD CONSTRAINT concerns_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid);


--
-- Name: faq_knowledge_base faq_knowledge_base_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_knowledge_base
    ADD CONSTRAINT faq_knowledge_base_pkey PRIMARY KEY (id);


--
-- Name: interviews interviews_application_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_application_id_unique UNIQUE (application_id);


--
-- Name: interviews interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_pkey PRIMARY KEY (id);


--
-- Name: job_batches job_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_batches
    ADD CONSTRAINT job_batches_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: landing_photos landing_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_photos
    ADD CONSTRAINT landing_photos_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: monthly_reports monthly_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_reports
    ADD CONSTRAINT monthly_reports_pkey PRIMARY KEY (id);


--
-- Name: monthly_reports monthly_reports_user_id_assignment_id_month_year_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_reports
    ADD CONSTRAINT monthly_reports_user_id_assignment_id_month_year_unique UNIQUE (user_id, assignment_id, month, year);


--
-- Name: narrative_reports narrative_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.narrative_reports
    ADD CONSTRAINT narrative_reports_pkey PRIMARY KEY (id);


--
-- Name: narrative_reports narrative_reports_time_log_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.narrative_reports
    ADD CONSTRAINT narrative_reports_time_log_id_unique UNIQUE (time_log_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offices offices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offices
    ADD CONSTRAINT offices_pkey PRIMARY KEY (id);


--
-- Name: one_time_codes one_time_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.one_time_codes
    ADD CONSTRAINT one_time_codes_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email);


--
-- Name: pending_registrations pending_registrations_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_registrations
    ADD CONSTRAINT pending_registrations_email_unique UNIQUE (email);


--
-- Name: pending_registrations pending_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_registrations
    ADD CONSTRAINT pending_registrations_pkey PRIMARY KEY (id);


--
-- Name: personal_access_tokens personal_access_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_pkey PRIMARY KEY (id);


--
-- Name: personal_access_tokens personal_access_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_unique UNIQUE (token);


--
-- Name: promissory_notes promissory_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promissory_notes
    ADD CONSTRAINT promissory_notes_pkey PRIMARY KEY (id);


--
-- Name: semester_periods semester_periods_academic_year_semester_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semester_periods
    ADD CONSTRAINT semester_periods_academic_year_semester_unique UNIQUE (academic_year, semester);


--
-- Name: semester_periods semester_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semester_periods
    ADD CONSTRAINT semester_periods_pkey PRIMARY KEY (id);


--
-- Name: semester_reports semester_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semester_reports
    ADD CONSTRAINT semester_reports_pkey PRIMARY KEY (id);


--
-- Name: semester_reports semester_reports_user_id_academic_year_semester_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semester_reports
    ADD CONSTRAINT semester_reports_user_id_academic_year_semester_unique UNIQUE (user_id, academic_year, semester);


--
-- Name: settings settings_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_key_unique UNIQUE (key);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: staff_invitations staff_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invitations
    ADD CONSTRAINT staff_invitations_pkey PRIMARY KEY (id);


--
-- Name: staff_invitations staff_invitations_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invitations
    ADD CONSTRAINT staff_invitations_token_unique UNIQUE (token);


--
-- Name: stipend_history stipend_history_claim_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stipend_history
    ADD CONSTRAINT stipend_history_claim_token_unique UNIQUE (claim_token);


--
-- Name: stipend_history stipend_history_control_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stipend_history
    ADD CONSTRAINT stipend_history_control_number_unique UNIQUE (control_number);


--
-- Name: stipend_history stipend_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stipend_history
    ADD CONSTRAINT stipend_history_pkey PRIMARY KEY (id);


--
-- Name: stipend_signatures stipend_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stipend_signatures
    ADD CONSTRAINT stipend_signatures_pkey PRIMARY KEY (id);


--
-- Name: student_profiles student_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profiles
    ADD CONSTRAINT student_profiles_pkey PRIMARY KEY (id);


--
-- Name: student_profiles student_profiles_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profiles
    ADD CONSTRAINT student_profiles_user_id_unique UNIQUE (user_id);


--
-- Name: term_evaluations term_evaluations_assignment_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.term_evaluations
    ADD CONSTRAINT term_evaluations_assignment_id_unique UNIQUE (assignment_id);


--
-- Name: term_evaluations term_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.term_evaluations
    ADD CONSTRAINT term_evaluations_pkey PRIMARY KEY (id);


--
-- Name: term_reports term_reports_assignment_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.term_reports
    ADD CONSTRAINT term_reports_assignment_id_unique UNIQUE (assignment_id);


--
-- Name: term_reports term_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.term_reports
    ADD CONSTRAINT term_reports_pkey PRIMARY KEY (id);


--
-- Name: testing_snapshots testing_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testing_snapshots
    ADD CONSTRAINT testing_snapshots_pkey PRIMARY KEY (id);


--
-- Name: testing_snapshots testing_snapshots_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testing_snapshots
    ADD CONSTRAINT testing_snapshots_user_id_unique UNIQUE (user_id);


--
-- Name: time_logs time_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_logs
    ADD CONSTRAINT time_logs_pkey PRIMARY KEY (id);


--
-- Name: trusted_devices trusted_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_pkey PRIMARY KEY (id);


--
-- Name: trusted_devices trusted_devices_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_token_hash_unique UNIQUE (token_hash);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_employee_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_unique UNIQUE (employee_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verifications verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);


--
-- Name: weekly_reports weekly_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT weekly_reports_pkey PRIMARY KEY (id);


--
-- Name: weekly_reports weekly_reports_user_id_academic_year_semester_week_number_uniqu; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT weekly_reports_user_id_academic_year_semester_week_number_uniqu UNIQUE (user_id, academic_year, semester, week_number);


--
-- Name: application_documents_application_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX application_documents_application_id_index ON public.application_documents USING btree (application_id);


--
-- Name: application_documents_document_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX application_documents_document_type_index ON public.application_documents USING btree (document_type);


--
-- Name: applications_academic_year_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_academic_year_index ON public.applications USING btree (academic_year);


--
-- Name: applications_one_per_term_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX applications_one_per_term_unique ON public.applications USING btree (user_id, academic_year, semester) WHERE (NOT (((type)::text = 'renewal'::text) AND (status = 'rejected'::public.application_status)));


--
-- Name: applications_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_status_idx ON public.applications USING btree (status);


--
-- Name: applications_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_type_index ON public.applications USING btree (type);


--
-- Name: applications_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX applications_user_id_index ON public.applications USING btree (user_id);


--
-- Name: assignments_academic_year_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignments_academic_year_index ON public.assignments USING btree (academic_year);


--
-- Name: assignments_office_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignments_office_id_index ON public.assignments USING btree (office_id);


--
-- Name: assignments_one_active_per_term; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX assignments_one_active_per_term ON public.assignments USING btree (user_id, academic_year, semester) WHERE ((status)::text = 'active'::text);


--
-- Name: assignments_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignments_status_index ON public.assignments USING btree (status);


--
-- Name: assignments_supervisor_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignments_supervisor_id_index ON public.assignments USING btree (supervisor_id);


--
-- Name: assignments_term_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignments_term_status_index ON public.assignments USING btree (term_status);


--
-- Name: assignments_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignments_user_id_index ON public.assignments USING btree (user_id);


--
-- Name: audit_logs_action_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_action_index ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_auditable_type_auditable_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_auditable_type_auditable_id_index ON public.audit_logs USING btree (auditable_type, auditable_id);


--
-- Name: audit_logs_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_created_at_index ON public.audit_logs USING btree (created_at);


--
-- Name: audit_logs_subject_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_subject_user_id_index ON public.audit_logs USING btree (subject_user_id);


--
-- Name: audit_logs_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_user_id_index ON public.audit_logs USING btree (user_id);


--
-- Name: concern_messages_concern_id_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX concern_messages_concern_id_id_index ON public.concern_messages USING btree (concern_id, id);


--
-- Name: concerns_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX concerns_status_index ON public.concerns USING btree (status);


--
-- Name: concerns_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX concerns_user_id_index ON public.concerns USING btree (user_id);


--
-- Name: faq_knowledge_base_category_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX faq_knowledge_base_category_index ON public.faq_knowledge_base USING btree (category);


--
-- Name: faq_knowledge_base_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX faq_knowledge_base_is_active_index ON public.faq_knowledge_base USING btree (is_active);


--
-- Name: interviews_application_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interviews_application_id_index ON public.interviews USING btree (application_id);


--
-- Name: interviews_scheduled_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interviews_scheduled_at_index ON public.interviews USING btree (scheduled_at);


--
-- Name: interviews_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX interviews_status_index ON public.interviews USING btree (status);


--
-- Name: jobs_queue_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_queue_index ON public.jobs USING btree (queue);


--
-- Name: landing_photos_is_active_sort_order_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX landing_photos_is_active_sort_order_index ON public.landing_photos USING btree (is_active, sort_order);


--
-- Name: monthly_reports_assignment_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX monthly_reports_assignment_id_index ON public.monthly_reports USING btree (assignment_id);


--
-- Name: monthly_reports_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX monthly_reports_user_id_index ON public.monthly_reports USING btree (user_id);


--
-- Name: narrative_reports_time_log_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX narrative_reports_time_log_id_index ON public.narrative_reports USING btree (time_log_id);


--
-- Name: notifications_notifiable_type_notifiable_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_notifiable_type_notifiable_id_index ON public.notifications USING btree (notifiable_type, notifiable_id);


--
-- Name: notifications_read_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_read_at_index ON public.notifications USING btree (read_at);


--
-- Name: notifications_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_type_index ON public.notifications USING btree (type);


--
-- Name: offices_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offices_is_active_index ON public.offices USING btree (is_active);


--
-- Name: one_time_codes_user_id_purpose_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX one_time_codes_user_id_purpose_index ON public.one_time_codes USING btree (user_id, purpose);


--
-- Name: pending_registrations_student_id_number_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pending_registrations_student_id_number_index ON public.pending_registrations USING btree (student_id_number);


--
-- Name: personal_access_tokens_tokenable_type_tokenable_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX personal_access_tokens_tokenable_type_tokenable_id_index ON public.personal_access_tokens USING btree (tokenable_type, tokenable_id);


--
-- Name: promissory_notes_assignment_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promissory_notes_assignment_id_index ON public.promissory_notes USING btree (assignment_id);


--
-- Name: promissory_notes_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promissory_notes_status_index ON public.promissory_notes USING btree (status);


--
-- Name: promissory_notes_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promissory_notes_user_id_index ON public.promissory_notes USING btree (user_id);


--
-- Name: semester_periods_start_date_end_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX semester_periods_start_date_end_date_index ON public.semester_periods USING btree (start_date, end_date);


--
-- Name: semester_reports_assignment_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX semester_reports_assignment_id_index ON public.semester_reports USING btree (assignment_id);


--
-- Name: semester_reports_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX semester_reports_user_id_index ON public.semester_reports USING btree (user_id);


--
-- Name: staff_invitations_email_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_invitations_email_index ON public.staff_invitations USING btree (email);


--
-- Name: stipend_history_academic_year_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stipend_history_academic_year_index ON public.stipend_history USING btree (academic_year);


--
-- Name: stipend_history_control_number_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stipend_history_control_number_index ON public.stipend_history USING btree (control_number);


--
-- Name: stipend_history_one_live_per_period; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stipend_history_one_live_per_period ON public.stipend_history USING btree (user_id, academic_year, semester) WHERE ((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('certified'::character varying)::text, ('claimed'::character varying)::text, ('released'::character varying)::text]));


--
-- Name: stipend_history_released_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stipend_history_released_by_index ON public.stipend_history USING btree (released_by);


--
-- Name: stipend_history_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stipend_history_status_index ON public.stipend_history USING btree (status);


--
-- Name: stipend_history_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stipend_history_user_id_index ON public.stipend_history USING btree (user_id);


--
-- Name: stipend_signatures_signatory_role_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stipend_signatures_signatory_role_index ON public.stipend_signatures USING btree (signatory_role);


--
-- Name: stipend_signatures_stipend_history_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stipend_signatures_stipend_history_id_index ON public.stipend_signatures USING btree (stipend_history_id);


--
-- Name: student_profiles_student_id_number_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_profiles_student_id_number_index ON public.student_profiles USING btree (student_id_number);


--
-- Name: student_profiles_student_id_number_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX student_profiles_student_id_number_unique ON public.student_profiles USING btree (student_id_number) WHERE (deleted_at IS NULL);


--
-- Name: student_profiles_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_profiles_user_id_index ON public.student_profiles USING btree (user_id);


--
-- Name: time_logs_assignment_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_logs_assignment_id_index ON public.time_logs USING btree (assignment_id);


--
-- Name: time_logs_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_logs_date_index ON public.time_logs USING btree (date);


--
-- Name: time_logs_one_open_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX time_logs_one_open_per_user ON public.time_logs USING btree (user_id) WHERE (status = 'open'::public.time_log_status);


--
-- Name: time_logs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_logs_status_idx ON public.time_logs USING btree (status);


--
-- Name: time_logs_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_logs_user_id_index ON public.time_logs USING btree (user_id);


--
-- Name: time_logs_verified_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX time_logs_verified_by_index ON public.time_logs USING btree (verified_by);


--
-- Name: users_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_deleted_at_idx ON public.users USING btree (deleted_at);


--
-- Name: users_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_is_active_idx ON public.users USING btree (is_active);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: verifications_action_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verifications_action_index ON public.verifications USING btree (action);


--
-- Name: verifications_time_log_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verifications_time_log_id_index ON public.verifications USING btree (time_log_id);


--
-- Name: verifications_verified_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verifications_verified_by_index ON public.verifications USING btree (verified_by);


--
-- Name: weekly_reports_assignment_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX weekly_reports_assignment_id_index ON public.weekly_reports USING btree (assignment_id);


--
-- Name: weekly_reports_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX weekly_reports_user_id_index ON public.weekly_reports USING btree (user_id);


--
-- Name: weekly_reports_week_start_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX weekly_reports_week_start_index ON public.weekly_reports USING btree (week_start);


--
-- Name: announcement_attachments announcement_attachments_announcement_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_attachments
    ADD CONSTRAINT announcement_attachments_announcement_id_foreign FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcements announcements_office_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_office_id_foreign FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE SET NULL;


--
-- Name: announcements announcements_sent_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_sent_by_foreign FOREIGN KEY (sent_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: application_documents application_documents_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_documents
    ADD CONSTRAINT application_documents_application_id_foreign FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: applications applications_reviewed_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_reviewed_by_foreign FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: applications applications_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_carried_from_assignment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_carried_from_assignment_id_foreign FOREIGN KEY (carried_from_assignment_id) REFERENCES public.assignments(id) ON DELETE SET NULL;


--
-- Name: assignments assignments_office_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_office_id_foreign FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE RESTRICT;


--
-- Name: assignments assignments_pending_required_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pending_required_by_foreign FOREIGN KEY (pending_required_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: assignments assignments_supervisor_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_supervisor_id_foreign FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: assignments assignments_term_status_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_term_status_by_foreign FOREIGN KEY (term_status_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: assignments assignments_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_subject_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_subject_user_id_foreign FOREIGN KEY (subject_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: concern_messages concern_messages_concern_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concern_messages
    ADD CONSTRAINT concern_messages_concern_id_foreign FOREIGN KEY (concern_id) REFERENCES public.concerns(id) ON DELETE CASCADE;


--
-- Name: concern_messages concern_messages_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concern_messages
    ADD CONSTRAINT concern_messages_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: concerns concerns_responded_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concerns
    ADD CONSTRAINT concerns_responded_by_foreign FOREIGN KEY (responded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: concerns concerns_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concerns
    ADD CONSTRAINT concerns_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: interviews interviews_application_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_application_id_foreign FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: landing_photos landing_photos_uploaded_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_photos
    ADD CONSTRAINT landing_photos_uploaded_by_foreign FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: monthly_reports monthly_reports_assignment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_reports
    ADD CONSTRAINT monthly_reports_assignment_id_foreign FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: monthly_reports monthly_reports_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_reports
    ADD CONSTRAINT monthly_reports_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: narrative_reports narrative_reports_time_log_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.narrative_reports
    ADD CONSTRAINT narrative_reports_time_log_id_foreign FOREIGN KEY (time_log_id) REFERENCES public.time_logs(id) ON DELETE CASCADE;


--
-- Name: one_time_codes one_time_codes_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.one_time_codes
    ADD CONSTRAINT one_time_codes_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: promissory_notes promissory_notes_assignment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promissory_notes
    ADD CONSTRAINT promissory_notes_assignment_id_foreign FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: promissory_notes promissory_notes_reviewed_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promissory_notes
    ADD CONSTRAINT promissory_notes_reviewed_by_foreign FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: promissory_notes promissory_notes_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promissory_notes
    ADD CONSTRAINT promissory_notes_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: semester_periods semester_periods_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semester_periods
    ADD CONSTRAINT semester_periods_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: semester_reports semester_reports_assignment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semester_reports
    ADD CONSTRAINT semester_reports_assignment_id_foreign FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: semester_reports semester_reports_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semester_reports
    ADD CONSTRAINT semester_reports_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: staff_invitations staff_invitations_invited_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invitations
    ADD CONSTRAINT staff_invitations_invited_by_foreign FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: staff_invitations staff_invitations_office_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_invitations
    ADD CONSTRAINT staff_invitations_office_id_foreign FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE SET NULL;


--
-- Name: stipend_history stipend_history_certified_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stipend_history
    ADD CONSTRAINT stipend_history_certified_by_foreign FOREIGN KEY (certified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stipend_history stipend_history_promissory_note_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stipend_history
    ADD CONSTRAINT stipend_history_promissory_note_id_foreign FOREIGN KEY (promissory_note_id) REFERENCES public.promissory_notes(id) ON DELETE SET NULL;


--
-- Name: stipend_history stipend_history_released_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stipend_history
    ADD CONSTRAINT stipend_history_released_by_foreign FOREIGN KEY (released_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stipend_history stipend_history_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stipend_history
    ADD CONSTRAINT stipend_history_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stipend_signatures stipend_signatures_stipend_history_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stipend_signatures
    ADD CONSTRAINT stipend_signatures_stipend_history_id_foreign FOREIGN KEY (stipend_history_id) REFERENCES public.stipend_history(id) ON DELETE CASCADE;


--
-- Name: stipend_signatures stipend_signatures_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stipend_signatures
    ADD CONSTRAINT stipend_signatures_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: student_profiles student_profiles_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profiles
    ADD CONSTRAINT student_profiles_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: term_evaluations term_evaluations_assignment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.term_evaluations
    ADD CONSTRAINT term_evaluations_assignment_id_foreign FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: term_evaluations term_evaluations_evaluator_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.term_evaluations
    ADD CONSTRAINT term_evaluations_evaluator_id_foreign FOREIGN KEY (evaluator_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: term_reports term_reports_assignment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.term_reports
    ADD CONSTRAINT term_reports_assignment_id_foreign FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: term_reports term_reports_reviewed_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.term_reports
    ADD CONSTRAINT term_reports_reviewed_by_foreign FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: term_reports term_reports_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.term_reports
    ADD CONSTRAINT term_reports_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: testing_snapshots testing_snapshots_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testing_snapshots
    ADD CONSTRAINT testing_snapshots_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: time_logs time_logs_assignment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_logs
    ADD CONSTRAINT time_logs_assignment_id_foreign FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: time_logs time_logs_recorded_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_logs
    ADD CONSTRAINT time_logs_recorded_by_foreign FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: time_logs time_logs_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_logs
    ADD CONSTRAINT time_logs_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: time_logs time_logs_verified_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_logs
    ADD CONSTRAINT time_logs_verified_by_foreign FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: trusted_devices trusted_devices_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_office_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_office_id_foreign FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE SET NULL;


--
-- Name: verifications verifications_time_log_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_time_log_id_foreign FOREIGN KEY (time_log_id) REFERENCES public.time_logs(id) ON DELETE CASCADE;


--
-- Name: verifications verifications_verified_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_verified_by_foreign FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: weekly_reports weekly_reports_assignment_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT weekly_reports_assignment_id_foreign FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: weekly_reports weekly_reports_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT weekly_reports_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 4RVWZYzU1JLfcVIwc8dC7dK1isg7hE1j5T65E060pL2nrN6cWDKQ1W5Klhcnaus

