import { Suspense } from 'react';
import EditChickenBatchForm from './EditChickenBatchForm';
import Loading from '@/app/loading';

export default async function EditChickenBatchPage({
  params
}: {
  params: { id: string }
}) {
  return (
    <Suspense fallback={<Loading />}>
      <EditChickenBatchForm id={params.id} />
    </Suspense>
  );
} 