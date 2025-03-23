import { Suspense } from 'react';
import EditChickenBatchForm from './EditChickenBatchForm';

export default function Page({ params }: { params: { id: string } }) {
    return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditChickenBatchForm id={params.id} />
    </Suspense>
  );
} 