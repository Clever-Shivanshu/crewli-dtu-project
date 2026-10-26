import { CATALOG, SKILLS, PROFESSIONS, LANGUAGES, ADD_ONS, getSubProblem } from '../catalog.js';
import { getDB } from '../db.js';

export default async function catalogRoutes(fastify) {
  // GET /catalog/nearest-eta?lat=&lng= — cheap ETA estimate for the customer
  // home screen. Looks at the single nearest available worker and converts
  // the geo-distance into minutes using a 25 km/h average (urban).
  fastify.get('/catalog/nearest-eta', async (req, reply) => {
    const lat = parseFloat(req.query?.lat);
    const lng = parseFloat(req.query?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return reply.code(400).send({ error: 'lat_lng_required' });
    }
    const db = getDB();
    // $geoNear uses the 2dsphere index on `workers.location` and returns the
    // distance (in metres) directly — no need for a client-side haversine.
    const [nearest] = await db.collection('workers').aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceM',
          spherical: true,
          query: { isAvailable: true },
          maxDistance: 30000, // 30 km hard cap
        },
      },
      { $limit: 1 },
      { $project: { distanceM: 1 } },
    ]).toArray();

    if (!nearest) {
      return { available: false, etaMin: null, distanceKm: null };
    }
    const km = nearest.distanceM / 1000;
    const etaMin = Math.max(1, Math.round((km / 25) * 60));
    return { available: true, etaMin, distanceKm: Number(km.toFixed(2)) };
  });

  // GET /catalog  — customer Home Screen cards.
  fastify.get('/catalog', async () => ({
    problems: CATALOG,
    skills: SKILLS,
    addOns: ADD_ONS,
  }));

  // GET /catalog/sub/:id — resolve a sub-problem id to its skill + pricing + available add-ons.
  fastify.get('/catalog/sub/:id', async (req, reply) => {
    const sp = getSubProblem(req.params.id);
    if (!sp) return reply.code(404).send({ error: 'sub_problem_not_found' });
    return { ...sp, skill: SKILLS[sp.skillKey], addOns: ADD_ONS };
  });

  // GET /catalog/professions — worker onboarding (Select Profession).
  // Returns each profession with its *hydrated* skill list for convenience.
  fastify.get('/catalog/professions', async () => {
    const professions = Object.entries(PROFESSIONS).map(([key, p]) => ({
      key,
      label: p.label,
      skills: p.skillKeys.map((sk) => ({
        key: sk,
        label: SKILLS[sk].label,
        basePrice: SKILLS[sk].basePrice,
        perKmRate: SKILLS[sk].perKmRate,
      })),
    }));
    return { professions };
  });

  // GET /catalog/languages — onboarding language grid.
  fastify.get('/catalog/languages', async () => ({ languages: LANGUAGES }));
}
