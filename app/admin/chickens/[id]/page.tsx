import { Suspense } from 'react';
import ChickenBatchDetail from './ChickenBatchDetail';

export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChickenBatchDetail params={params} />
    </Suspense>
  );
}