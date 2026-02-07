import ClientPage from './ClientReservationPage'  // 注意檔名

export async function generateStaticParams() {
  return [{ tripId: "acb6f4ba-3009-4a20-9bea-89ed28365972" }]
}

export default ClientPage
