import React from 'react';
import PassportMapPreview from '@/components/PassportMapPreview';
import { VisitedPlace } from '@/types';

interface Props {
  places: VisitedPlace[];
}

export default function HomeMap({ places }: Props) {
  return <PassportMapPreview places={places} />;
}
