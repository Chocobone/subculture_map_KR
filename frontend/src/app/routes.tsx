import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/shared/components/layout/AppShell';

const MapPage         = lazy(() => import('@/pages/MapPage'));
const ListPage        = lazy(() => import('@/pages/ListPage'));
const NewPage         = lazy(() => import('@/pages/NewPage'));
const MyPage          = lazy(() => import('@/pages/MyPage'));
const EventDetailPage = lazy(() => import('@/pages/EventDetailPage'));

const Fallback = () => (
  <div className="flex h-full items-center justify-center text-gray-400">로딩 중...</div>
);

export function AppRoutes() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="map"  element={<MapPage />} />
          <Route path="list" element={<ListPage />} />
          <Route path="new"  element={<NewPage />} />
          <Route path="my"   element={<MyPage />} />
          <Route index element={<Navigate to="/map" replace />} />
        </Route>
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="*" element={<Navigate to="/map" replace />} />
      </Routes>
    </Suspense>
  );
}
