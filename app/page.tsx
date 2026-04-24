export default function Page() {
  const configEndpoint = "/api/supabase/config"

  return (
    <>
      <link
        rel="preload"
        href={configEndpoint}
        as="fetch"
        crossOrigin="anonymous"
      />
      <div dangerouslySetInnerHTML={{ __html: `` }} />
    </>
  );
}
