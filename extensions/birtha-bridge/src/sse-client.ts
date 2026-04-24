export async function* createSseJsonEventIterator(
  response: Response,
): AsyncGenerator<Record<string, unknown>> {
  if (!response.body) {
    throw new Error("birtha_query_stream: response body is missing");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLines = rawEvent
        .replace(/\r/g, "")
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .filter(Boolean);
      if (dataLines.length > 0) {
        const data = dataLines.join("\n");
        yield JSON.parse(data) as Record<string, unknown>;
      }
      boundary = buffer.indexOf("\n\n");
    }

    if (done) {
      const trailing = buffer.replace(/\r/g, "").trim();
      if (trailing) {
        const dataLines = trailing
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .filter(Boolean);
        if (dataLines.length > 0) {
          yield JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
        }
      }
      return;
    }
  }
}
