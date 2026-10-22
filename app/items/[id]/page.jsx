export const dynamic = "force-dynamic";
export default async function Item({ params }) {
  const { id } = await params;
  return <p>item {id}</p>;
}
