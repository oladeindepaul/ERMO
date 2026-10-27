import { NextResponse, type NextRequest } from "next/server";
import { placeAt, searchPlaces } from "@/lib/places";

// Suggestions for the location box: ?q=text, or ?lat=&lng= for "Use my location".
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (sp.has("lat") && Number.isFinite(lat) && Number.isFinite(lng)) {
    const place = await placeAt(lat, lng);
    return NextResponse.json(place ? [place] : []);
  }
  const places = await searchPlaces((sp.get("q") ?? "").slice(0, 60));
  return NextResponse.json(places, { headers: { "Cache-Control": "public, max-age=3600" } });
}
