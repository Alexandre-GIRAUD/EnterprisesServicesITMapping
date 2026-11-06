/**
 * Main map view: graph visualization and drill-down.
 * Filters live in the FilterDrawer (applied on submit) inside GraphCanvas.
 * `?asOf=YYYY-MM-DD` shows Production as it stood that day, read-only.
 */
import { useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { setViewingDay } from '@/config/api';
import { GraphCanvas } from '../components/GraphCanvas';

const AS_OF_PARAM = 'asOf';

export function MapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewingDay = searchParams.get(AS_OF_PARAM);

  // Layout effect: runs before the remounted canvas starts fetching.
  useLayoutEffect(() => {
    setViewingDay(viewingDay);
    return () => setViewingDay(null);
  }, [viewingDay]);

  function changeViewingDay(day: string | null) {
    setSearchParams((params) => {
      if (day) params.set(AS_OF_PARAM, day);
      else params.delete(AS_OF_PARAM);
      return params;
    });
  }

  return (
    <div className="map-page">
      <GraphCanvas
        key={viewingDay ?? 'live'}
        viewingDay={viewingDay}
        onViewingDayChange={changeViewingDay}
      />
    </div>
  );
}
