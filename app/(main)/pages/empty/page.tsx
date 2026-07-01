'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

const formatTime = (value: number) => String(value).padStart(2, '0');

const EmptyPage = () => {
    const targetDate = useMemo(() => {
        const now = new Date();
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }, []);

    const [remaining, setRemaining] = useState({
        days: 7,
        hours: 0,
        minutes: 0,
        seconds: 0
    });

    useEffect(() => {
        const updateRemaining = () => {
            const now = new Date();
            const difference = targetDate.getTime() - now.getTime();
            const totalSeconds = Math.max(0, Math.floor(difference / 1000));

            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            setRemaining({ days, hours, minutes, seconds });
        };

        updateRemaining();
        const interval = setInterval(updateRemaining, 1000);
        return () => clearInterval(interval);
    }, [targetDate]);

    return (
        <div className="grid justify-content-center">
            <div className="col-12 md:col-8 lg:col-6">
                <div className="card surface-0 shadow-2 text-center p-6">
                    <div className="mb-5 flex justify-content-center">
                        <div className="w-40 h-40 surface-card border-round shadow-1 flex align-items-center justify-content-center">
                            <Image src="/maintenance.svg" alt="Mantenimiento" width={160} height={160} />
                        </div>
                    </div>
                    <h2 className="text-900 mb-3">Estamos en mantenimiento</h2>
                    <p className="text-600 mb-5">
                        Esta sección está temporalmente deshabilitada mientras trabajamos en mejoras. Regresa pronto.
                    </p>
                    <div className="surface-card border-round p-4 shadow-1">
                        <div className="text-700 mb-3">Tiempo restante</div>
                        <div className="flex align-items-center justify-content-center gap-3 text-900 text-xl">
                            <div>
                                <div className="text-4xl font-bold">{formatTime(remaining.days)}</div>
                                <div className="text-sm text-600">Días</div>
                            </div>
                            <div>:</div>
                            <div>
                                <div className="text-4xl font-bold">{formatTime(remaining.hours)}</div>
                                <div className="text-sm text-600">Horas</div>
                            </div>
                            <div>:</div>
                            <div>
                                <div className="text-4xl font-bold">{formatTime(remaining.minutes)}</div>
                                <div className="text-sm text-600">Minutos</div>
                            </div>
                            <div>:</div>
                            <div>
                                <div className="text-4xl font-bold">{formatTime(remaining.seconds)}</div>
                                <div className="text-sm text-600">Segundos</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmptyPage;
