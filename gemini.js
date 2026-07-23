const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function getGeminiApiKey() {
  return localStorage.getItem("gemini_api_key") || "";
}

function setGeminiApiKey(key) {
  if (key) localStorage.setItem("gemini_api_key", key);
  else localStorage.removeItem("gemini_api_key");
}

async function callGemini(body) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("설정 탭에서 Google Gemini API 키를 먼저 입력해주세요.");
  }
  const res = await fetch(
    `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `API 오류 (${res.status})`);
  }
  return data;
}

function extractFinalJson(response) {
  const candidate = response.candidates?.[0];
  const part = candidate?.content?.parts?.find((p) => p.text);
  if (!part) throw new Error("응답에 텍스트가 없습니다.");
  return JSON.parse(part.text);
}

async function analyzeWineLabel(base64Data, mediaType) {
  const schema = {
    type: "OBJECT",
    properties: {
      name: { type: "STRING" },
      vintage: { type: "INTEGER", nullable: true },
      producer: { type: "STRING", nullable: true },
      variety: { type: "STRING", nullable: true },
      region: { type: "STRING", nullable: true },
      country: { type: "STRING", nullable: true },
      style: {
        type: "STRING",
        nullable: true,
        enum: ["레드", "화이트", "스파클링", "로제", "주정강화", "기타"],
      },
      uncertain_fields: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: [
      "name",
      "vintage",
      "producer",
      "variety",
      "region",
      "country",
      "style",
      "uncertain_fields",
    ],
  };

  const response = await callGemini({
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "당신은 와인 라벨을 읽어 정보를 추출하는 전문가입니다. 라벨에서 실제로 읽을 수 있는 정보만 채우세요. " +
              "라벨에 없거나 확신할 수 없는 항목은 생략하고 uncertain_fields 배열에 그 필드명을 추가하세요. " +
              "절대 추측해서 지어내지 마세요.\n\n이 와인 라벨 사진에서 정보를 추출해주세요.",
          },
          { inline_data: { mime_type: mediaType, data: base64Data } },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: schema,
    },
  });
  return extractFinalJson(response);
}

async function lookupVarietyAndDrinkWindow({ name, producer, vintage }) {
  const schema = {
    type: "OBJECT",
    properties: {
      variety: { type: "STRING", nullable: true },
      drink_window_start: { type: "INTEGER", nullable: true },
      drink_window_end: { type: "INTEGER", nullable: true },
      confidence: { type: "STRING", enum: ["알고있음", "불확실", "모름"] },
      note: { type: "STRING" },
    },
    required: [
      "variety",
      "drink_window_start",
      "drink_window_end",
      "confidence",
      "note",
    ],
  };

  const response = await callGemini({
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "당신은 와인 지식을 가진 소믈리에입니다. 이 기능은 실시간 웹 검색 없이 학습된 지식만으로 답합니다. " +
              "확실히 아는 경우에만 채우고, 모르거나 불확실하면 null로 두고 confidence를 '불확실' 또는 '모름'으로 " +
              "표시하세요. 절대 추측해서 지어내지 마세요.\n\n" +
              `와인: ${name}${producer ? `, 생산자: ${producer}` : ""}${vintage ? `, 빈티지: ${vintage}` : ""}\n` +
              "이 와인의 품종과 적정 음용 시기(연도 범위)를 알려주세요.",
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: schema,
    },
  });
  return extractFinalJson(response);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
