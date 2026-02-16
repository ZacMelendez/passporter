import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import { SnackbarProvider } from "notistack";

const queryClient = new QueryClient();

const theme = createTheme({
    palette: {
        mode: "dark",
        background: {
            default: "#050816",
            paper: "#111827",
        },
        primary: {
            main: "#38bdf8",
        },
        secondary: {
            main: "#a855f7",
        },
    },
    shape: {
        borderRadius: 10,
    },
});

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <SnackbarProvider autoHideDuration={10000}>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider theme={theme}>
                    <CssBaseline />
                    <App />
                </ThemeProvider>
            </QueryClientProvider>
        </SnackbarProvider>
    </StrictMode>,
);
