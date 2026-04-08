import { useEffect, useState } from "react";

export default function AppNav() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null; // Don't render on server
  }

  return (
    <s-app-nav>
      <s-link href="/app">Home</s-link>
      <s-link href="/app/additional">Additional page</s-link>
    </s-app-nav>
  );
}