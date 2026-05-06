import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import TransactionsPage from "./pages/TransactionsPage";
import StockPage from "./pages/StockPage";
import ProductsPage from "./pages/ProductsPage";
import RevenuePage from "./pages/RevenuePage";
import ExpensesPage from "./pages/ExpensesPage";
import SalesPage from "./pages/SalesPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import WithdrawalsPage from "./pages/WithdrawalsPage";
import AdjustmentsPage from "./pages/AdjustmentsPage";
import OpeningBalancePage from "./pages/OpeningBalancePage";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/opening-balance" element={<OpeningBalancePage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/stock" element={<StockPage />} />
              <Route path="/revenue" element={<RevenuePage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/withdrawals" element={<WithdrawalsPage />} />
              <Route path="/adjustments" element={<AdjustmentsPage />} />
              <Route path="/cash-adjustments" element={<AdjustmentsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
