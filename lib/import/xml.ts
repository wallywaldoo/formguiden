import { DOMParser } from "@xmldom/xmldom";

export type XmlElement = {
  getElementsByTagName(name: string): ArrayLike<XmlElement>;
  getAttribute(name: string): string | null;
  textContent: string | null;
};

export type XmlDocument = {
  documentElement: { localName: string } | null;
  getElementsByTagName(name: string): ArrayLike<XmlElement>;
};

function parseXml(xml: string): XmlDocument {
  const parser = new DOMParser({
    onError(level, message) {
      if (level === "fatalError" || level === "error") {
        throw new Error(message);
      }
    },
  });
  const doc = parser.parseFromString(
    xml,
    "application/xml",
  ) as unknown as XmlDocument;
  const rootName = doc.documentElement?.localName ?? "";
  if (rootName.toLowerCase() === "parsererror") {
    throw new Error("Ogiltig XML.");
  }
  return doc;
}

function text(node: XmlElement | null, name: string): string | null {
  const child = node?.getElementsByTagName(name)[0];
  const value = child?.textContent?.trim();
  return value ? value : null;
}

function numberFrom(node: XmlElement | null, name: string): number | null {
  const value = text(node, name);
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function elements(
  parent: XmlDocument | XmlElement,
  name: string,
): XmlElement[] {
  return Array.from(parent.getElementsByTagName(name));
}

export { parseXml, text, numberFrom, elements };
