export async function GET() {
  return Response.json({
    now: new Date().toISOString(),
    pilot_admin_code_enabled:
      process.env.PILOT_MODE === "1" && Boolean(process.env.PILOT_ADMIN_CODE),
  });
}
