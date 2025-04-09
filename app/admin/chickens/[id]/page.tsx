import { Suspense } from 'react';
import ChickenBatchDetail from './ChickenBatchDetail';
import Loading from '@/app/loading';

export default function ChickenBatchPage({
  params
}: {
  params: { id: string }
}) {
  // Simpan params.id ke variable baru untuk menghindari error
  const batchId = params.id;
  
  return (
    <Suspense fallback={<Loading />}>
      <ChickenBatchDetail batchId={batchId} />
    </Suspense>
  );
}