"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>页面暂时无法加载</h1>
      <p>请重试；运营操作不会自动重新提交。</p>
      <button className="primary" onClick={reset}>
        重试
      </button>
    </main>
  );
}
