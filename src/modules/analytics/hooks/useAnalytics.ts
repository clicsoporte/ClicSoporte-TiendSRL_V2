/**
 * @fileoverview Custom hook for managing the state and logic of the Analytics page.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import { getAnalyticsData } from '../lib/actions';
import type { AnalyticsData } from '@/modules/core/types';
import { logError } from '@/modules/core/lib/logger';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';

type AnalyticsState = {
    isLoading: boolean;
    kpis: AnalyticsData | null;
    dateRange?: DateRange;
};

const initialState: AnalyticsState = {
    isLoading: true,
    kpis: null,
    dateRange: {
        from: subDays(new Date(), 29),
        to: new Date(),
    },
};

export const useAnalytics = () => {
    const { isAuthorized } = useAuthorization(['analytics:read']);
    const { setTitle } = usePageTitle();
    const [state, setState] = useState<AnalyticsState>(initialState);

    const updateState = (newState: Partial<AnalyticsState>) => {
        setState(prevState => ({ ...prevState, ...newState }));
    };

    const fetchData = useCallback(async (range?: DateRange) => {
        updateState({ isLoading: true });
        try {
            const data = await getAnalyticsData(range);
            updateState({ kpis: data });
        } catch (error) {
            logError("Failed to fetch analytics data", { error: (error as Error).message });
        } finally {
            updateState({ isLoading: false });
        }
    }, []);

    useEffect(() => {
        setTitle("Analíticas y Reportes");
        if (isAuthorized) {
            fetchData(state.dateRange);
        }
    }, [isAuthorized, setTitle, state.dateRange, fetchData]);
    
    const actions = {
        setDateRange: (range: DateRange | undefined) => {
            updateState({ dateRange: range });
        },
    };

    return {
        state,
        actions
    };
};
