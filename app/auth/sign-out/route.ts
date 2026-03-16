import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/src/lib/auth/session";

const clearAuthCookies = (response: NextResponse) => {
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
};

const buildRedirectResponse = (request: Request) => {
  const response = NextResponse.redirect(new URL("/sign-in", request.url));
  clearAuthCookies(response);
  return response;
};

export async function GET(request: Request) {
  return buildRedirectResponse(request);
}

export async function POST(request: Request) {
  return buildRedirectResponse(request);
}
