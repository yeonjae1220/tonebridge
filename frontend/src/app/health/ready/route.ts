export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(
      `${process.env.API_URL ?? 'http://localhost:8080'}/actuator/health/readiness`,
      { signal: AbortSignal.timeout(2000) }
    );
    if (!res.ok) throw new Error(`backend ${res.status}`);
    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
