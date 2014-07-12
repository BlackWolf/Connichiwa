"use strict";

function CRURLParser(url)
{
  var parser = document.createElement("a");
  parser.href = url;

  return parser;
}
