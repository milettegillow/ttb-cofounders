import Nav from "../Nav";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Nav />
      <div className="ttb-container">
        {children}
      </div>
    </>
  );
}
