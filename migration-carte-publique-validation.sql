BEGIN;

ALTER TABLE public.signalements
  ADD COLUMN publication_carte_validee boolean NOT NULL DEFAULT false;

-- Seul le bureau peut lever le verrou. Tout déplacement impose une revue.
CREATE FUNCTION toh_private.garder_validation_carte()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.publication_carte_validee AND NOT toh_private.is_bureau() THEN
      RAISE EXCEPTION 'Validation de publication réservée au bureau';
    END IF;
  ELSE
    IF NEW.publication_carte_validee IS DISTINCT FROM OLD.publication_carte_validee
       AND NOT toh_private.is_bureau() THEN
      RAISE EXCEPTION 'Validation de publication réservée au bureau';
    END IF;
    IF ROW(NEW.lat,NEW.lng,NEW.type,NEW.adresse_source,NEW.adresse_plaignant)
       IS DISTINCT FROM ROW(OLD.lat,OLD.lng,OLD.type,OLD.adresse_source,OLD.adresse_plaignant) THEN
      NEW.publication_carte_validee := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION toh_private.garder_validation_carte() FROM PUBLIC;
CREATE TRIGGER garder_validation_carte BEFORE INSERT OR UPDATE ON public.signalements
  FOR EACH ROW EXECUTE FUNCTION toh_private.garder_validation_carte();

-- Interface existante conservée ; aucun UUID de dossier publié.
-- SECURITY DEFINER nécessaire à la projection anonyme : liste fermée de champs,
-- schéma privé, search_path vide, filtre explicite de validation par le bureau.
CREATE OR REPLACE FUNCTION toh_private.carte_publique()
RETURNS TABLE(id uuid,type text,commune text,intensite text,lat double precision,lng double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NULL::uuid,
    CASE WHEN s.type IN ('Voisinage (habitation)','Sono de voiture',
      'Bar / restaurant / discothèque','Chantier / travaux','Deux-roues / moteur',
      'Animaux','Manifestation / fête','Autre') THEN s.type ELSE 'Autre' END,
    s.commune,
    CASE WHEN s.intensite IN ('Faible','Moyenne','Forte','Insupportable')
      THEN s.intensite ELSE NULL::text END,
    s.lat,s.lng
  FROM public.signalements s
  WHERE s.publication_carte_validee
    AND s.lat BETWEEN -90 AND 90 AND s.lng BETWEEN -180 AND 180;
$$;

-- Un adhérent ne reçoit plus de détails concernant les dossiers des autres.
CREATE OR REPLACE FUNCTION toh_private.carte_membres()
RETURNS TABLE(id uuid,type text,commune text,quartier text,intensite text,
 horaire text,recurrence text,constat text,debut text,adresse_source text,
 description text,lat double precision,lng double precision,
 cree_le timestamp with time zone,horaire_detail text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.id,s.type,s.commune,NULL::text,s.intensite,
    NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,NULL::text,
    s.lat,s.lng,NULL::timestamptz,NULL::text
  FROM toh_private.carte_publique() s
  WHERE auth.uid() IS NOT NULL AND toh_private.membre_valide();
$$;

-- Les règles RLS existantes (propriétaire ou bureau) restent en place.
-- Aucun point existant approuvé automatiquement : revue humaine obligatoire.
COMMIT;
