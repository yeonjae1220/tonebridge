ALTER TABLE corrections
    ADD CONSTRAINT corrections_request_id_unique UNIQUE (request_id);
