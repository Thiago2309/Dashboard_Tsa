'use client';
import React from 'react';
import { OperadorVacaciones } from '../../../../../Services/BD/Vacaciones/vacacionesService';

interface SaldoVacacionesProps {
    operador: OperadorVacaciones;
    diasPendientes?: number;   // días en otras solicitudes aún sin autorizar
    diasSolicitados?: number;  // días de la solicitud que se está capturando/autorizando
}

const Dato = ({ titulo, valor, color }: { titulo: string; valor: React.ReactNode; color?: string }) => (
    <div className="col-6 md:col-2 text-center">
        <div className="text-500 text-xs mb-1">{titulo}</div>
        <div className={`text-xl font-bold ${color || ''}`}>{valor}</div>
    </div>
);

// Resumen del saldo de vacaciones del periodo actual de un empleado
const SaldoVacaciones = ({ operador, diasPendientes = 0, diasSolicitados = 0 }: SaldoVacacionesProps) => {
    if (operador.anios_cumplidos < 1) {
        return (
            <div className="p-3 mb-3 border-round bg-yellow-50 text-yellow-900 text-sm">
                <i className="pi pi-exclamation-triangle mr-2" />
                {operador.nombre} aún no cumple 1 año de antigüedad
                {operador.fecha_proximo_aniversario ? ` (lo cumple el ${operador.fecha_proximo_aniversario.toLocaleDateString('es-MX')})` : ''}, todavía
                no tiene días de vacaciones por ley.
            </div>
        );
    }

    const disponibles = operador.dias_disponibles - diasPendientes;
    const quedarian = disponibles - diasSolicitados;
    const { anios_cumplidos: a, meses_cumplidos: m } = operador;

    return (
        <div className="grid surface-50 border-round p-2 mb-3 mx-0">
            <Dato titulo="Antigüedad" valor={<span className="text-base">{`${a} ${a === 1 ? 'año' : 'años'} ${m} ${m === 1 ? 'mes' : 'meses'}`}</span>} />
            <Dato titulo="Le corresponden" valor={operador.dias_ley} color="text-blue-600" />
            <Dato titulo="Ya tomó" valor={operador.dias_disfrutados_periodo} color="text-orange-600" />
            <Dato titulo="Por autorizar" valor={diasPendientes} color="text-500" />
            <Dato titulo="Disponibles" valor={disponibles} color="text-green-600" />
            <Dato titulo="Le quedarían" valor={quedarian} color={quedarian < 0 ? 'text-red-600' : 'text-green-700'} />
        </div>
    );
};

export default SaldoVacaciones;
