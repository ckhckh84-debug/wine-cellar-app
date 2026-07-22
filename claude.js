const CLAUDE_MODEL = "claude-opus-4-8";
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

function getClaudeApiKey() {
  return localStorage.getItem("anthropic_api_key") || "";
}

function setClaudeApiKey(key) {
  if (key) localStorage.setItem("anthropic_api_key", key);
  else localStorage.removeItem("anthropic_api_key");
}

async function callClaude(body) {
  const apiKey = getClaudeApiKey();
  if (!apiKey) {
    throw new Error("설정 탭에서 Anthropic API 키를 먼저 입력해주세요.");
  }
  const res = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `API 오류 (${res.status})`);
  }
  return data;
}

function extractFinalJson(message) {
  const textBlocks = (message.content || []).filter((b) => b.type === "text");
  const last = textBlocks[textBlocks.length - 1];
  if (!last) throw new Error("응답에 텍스트가 없습니다.");
  return JSON.parse(last.text);
}

async function analyzeWineLabel(base64Data, mediaType) {
  const schema = {
    type: "object",
    properties: {
      name: { type: "string" },
      vintage: { type: ["integer", "null"] },
      producer: { type: ["string", "null"] },
      variety: { type: ["string", "null"] },
      region: { type: ["string", "null"] },
      country: { type: ["string", "null"] },
      style: { type: ["string", "null"], enum: ["레드", "화이트", "스파클링", "로제", "주정강화", "기타", null] },
      uncertain_fields: { type: "array", items: { type: "string" } },
    },
    required: ["name", "vintage", "producer", "variety", "region", "country", "style", "uncertain_fields"],
    additionalProperties: false,
  };

  const message = await callClaude({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system:
      "당신은 와인 라벨을 읽어 정보를 추출하는 전문가입니다. 라벨에서 실제로 읽을 수 있는 정보만 채우세요. " +
      "라벨에 없거나 확신할 수 없는 항목은 null로 두고, uncertain_fields 배열에 그 필드명을 추가하세요. 절대 추측해서 지어내지 마세요.",
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
          { type: "text", text: "이 와인 라벨 사진에서 정보를 추출해주세요." },
        ],
      },
    ],
    output_config: { format: { type: "json_schema", schema } },
  });
  return extractFinalJson(message);
}

async function lookupVarietyAndDrinkWindow({ name, producer, vintage }) {
  const schema = {
    type: "object",
    properties: {
      variety: { type: ["string", "null"] },
      drink_window_start: { type: ["integer", "null"] },
      drink_window_end: { type: ["integer", "null"] },
      sources: { type: "array", items: { type: "string" } },
      confidence: { type: "string", enum: ["확인됨", "불확실", "데이터 없음"] },
      note: { type: "string" },
    },
    required: ["variety", "drink_window_start", "drink_window_end", "sources", "confidence", "note"],
    additionalProperties: false,
  };

  const message = await callClaude({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    system:
      "당신은 와인 전문 정보를 조사하는 소믈리에입니다. 웹 검색으로 확인 가능한 공인된 자료(생산자 공식 자료, " +
      "Wine Spectator, Decanter, Vivino 등 평판 있는 소스)에서만 품종과 적정 음용 시기를 채우세요. " +
      "검색으로 명확히 확인되지 않으면 해당 필드는 null로 두고 confidence를 '불확실' 또는 '데이터 없음'으로 표시하세요. " +
      "절대 추측하거나 지어내지 마세요. sources에는 실제로 참고한 출처(사이트명 또는 URL)를 나열하세요.",
    messages: [
      {
        role: "user",
        content: `와인: ${name}${producer ? `, 생산자: ${producer}` : ""}${vintage ? `, 빈티지: ${vintage}` : ""}\n이 와인의 품종과 적정 음용 시기(연도 범위)를 조사해주세요.`,
      },
    ],
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
    output_config: { format: { type: "json_schema", schema } },
  });
  return extractFinalJson(message);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
