import React from "react";

export default function ReadonlyText({ value = "" }) {
  return React.createElement("pre", null, value);
}

export const Quill = Object.freeze({});
