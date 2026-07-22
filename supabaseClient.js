const isConfigured =
  window.SUPABASE_CONFIG.url.startsWith("http") &&
  !window.SUPABASE_CONFIG.anonKey.startsWith("YOUR_");

let supabaseClient = null;

if (isConfigured) {
  supabaseClient = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
  );
} else {
  document.addEventListener("DOMContentLoaded", () => {
    document.body.innerHTML =
      '<div style="max-width:420px;margin:15vh auto;padding:24px;text-align:center;font-family:sans-serif;">' +
      "<h2>⚙ 설정 필요</h2>" +
      "<p>config.js 파일에 Supabase 프로젝트 URL과 anon key를 입력한 뒤 새로고침하세요.</p>" +
      "</div>";
  });
}
