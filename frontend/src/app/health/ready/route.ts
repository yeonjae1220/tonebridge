export const dynamic = 'force-dynamic';

export async function GET() {
  // BACKEND_INTERNAL_URL: 클러스터 내부 주소 (probe용)
  // API_URL이 외부 도메인인 경우 NetworkPolicy에 막히므로 내부 주소 우선 사용
  const backendUrl =
    process.env.BACKEND_INTERNAL_URL ?? process.env.API_URL ?? 'http://localhost:8080';

  try {
    const res = await fetch(`${backendUrl}/actuator/health/readiness`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`backend ${res.status}`);
    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
