import { NextResponse } from "next/server";
import { ScavengerError } from "./scavenger";

export function scavengerErrorResponse(error: unknown) {
  const err = error instanceof ScavengerError ? error : new ScavengerError("Unexpected error.", 500);
  return NextResponse.json({ error: { message: err.message, details: err.details } }, { status: err.statusCode });
}

export function publicScavengerError(error: unknown) {
  const err = error instanceof ScavengerError ? error : new ScavengerError("Unexpected error.", 500);
  return { message: err.message, details: err.details };
}
