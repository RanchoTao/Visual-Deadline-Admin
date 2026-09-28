import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <h1>页面不存在</h1>
      <Link className="primary" href="/dashboard">
        返回总览
      </Link>
    </main>
  );
}
