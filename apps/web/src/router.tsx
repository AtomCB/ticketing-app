import { createBrowserRouter } from "react-router";
import { HealthPage } from "./routes/HealthPage";
import { RootLayout } from "./routes/RootLayout";
import RouteError from "./routes/RouteError";
import { EventsPage } from "./routes/EventsPage";
import EventPage from "./routes/EventPage";
import NotFound from "./routes/NotFound";

const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        index: true,
        Component: EventsPage,
      },
      {
        path: "/health",
        Component: HealthPage,
      },
      {
        path: "/events/:eventId",
        Component: EventPage,
      },
      {
        path: "*",
        Component: NotFound,
      },
    ],
    errorElement: <RouteError />,
  },
]);

export default router;
