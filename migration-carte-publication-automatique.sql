BEGIN;
-- La validation de coordonnées est automatique ; aucune revue manuelle requise.
-- Les fonctions de projection et les règles d'accès aux dossiers restent inchangées.
CREATE OR REPLACE FUNCTION toh_private.garder_validation_carte()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  NEW.publication_carte_validee := COALESCE(
    NEW.lat BETWEEN -90 AND 90 AND NEW.lng BETWEEN -180 AND 180, false);
  RETURN NEW;
END;
$$;
UPDATE public.signalements
  SET publication_carte_validee = COALESCE(
    lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180, false);
COMMIT;
