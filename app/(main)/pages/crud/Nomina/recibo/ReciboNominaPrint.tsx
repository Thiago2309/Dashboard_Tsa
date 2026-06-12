"use client";

import React, { forwardRef } from 'react';

interface ReciboNominaProps {
  nomina: any;
}

export const ReciboNominaPrint = forwardRef<HTMLDivElement, ReciboNominaProps>(({ nomina }, ref) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount || 0);
  };

  // Lógica de pago por alcance de meta
  let pagoAlcanceMeta = 0;
  let rebaso = false;

  if (nomina.total_viajes > 40000) {
      pagoAlcanceMeta = nomina.total_viajes * 0.1;
      rebaso = true;
  } else {
      pagoAlcanceMeta = 40000 * 0.1;
      rebaso = false;
  }

  const totalGross = pagoAlcanceMeta + (nomina.bono || 0);
  const netTotal = totalGross - (nomina.prestamos || 0);

  return (
    <div ref={ref} className="w-full max-w-md mx-auto bg-white p-4 font-sans text-xs print:p-2 print:max-w-none landscape-layout">
      {/* Contenedor principal horizontal más estrecho */}
      <div className="flex flex-row">
        {/* Sección izquierda - Información principal */}
        <div className="w-3/5 pr-3 border-r border-gray-300">
          {/* Encabezado compacto */}
          <div className="text-center mb-4">
            <h1 className="text-lg font-bold uppercase">Recibo de Nómina</h1>
            <p className="text-xs text-gray-600 mt-1">Transportes MX</p>
          </div>

          {/* Información del empleado compacta */}
          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="font-semibold">Nombre:</span>
              <span>{nomina.empleado_nombre || "MARCO BAEZA"}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="font-semibold">Semana:</span>
              <span>Semana {nomina.semana || "33"}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Fecha:</span>
              <span>8-14 ago 2025</span>
            </div>
          </div>

          {/* Detalles de pago compactos */}
          <div className="mb-4">
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span>NÓMINA</span>
              <span className="font-semibold">{formatCurrency(netTotal)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span>DESCUENTO</span>
              <span>{formatCurrency(nomina.prestamos || 0)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span>SALDO PRÉSTAMO</span>
              <span>{formatCurrency(0)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span>FONACOT</span>
              <span>{formatCurrency(0)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span>VIÁTICOS</span>
              <span>{formatCurrency(0)}</span>
            </div>
          </div>

          {/* Total compacto */}
          <div className="mb-4 text-center border-t border-b border-gray-300 py-2">
            <div className="text-md font-bold">{formatCurrency(netTotal)}</div>
            <div className="text-xs text-gray-600">16/ago/2025</div>
          </div>
        </div>

        {/* Sección derecha - Texto legal y firma (más estrecha) */}
        <div className="w-2/5 pl-3 flex flex-col justify-between">
          {/* Texto de conformidad más compacto */}
          <div className="text-xs leading-tight">
            <p>Este recibo es un comprobante que recibí de la empresa por la cantidad de {formatCurrency(netTotal)} como pago correspondiente a la semana numero {nomina.semana || "33"} de fecha 8 AL 14 ago 2025</p>
            <p className="mt-1">y consentido por las partes que se contrataron, por lo que con el cumplimiento del pago a mi persona, no existe cantidad y reclamación alguna que pueda realizar a la empresa.</p>
          </div>

          {/* Firma compacta */}
          <div className="text-center mt-2">
            <div className="border-t border-gray-400 mx-auto w-24 pt-1">
              <p className="font-semibold uppercase text-xs">{nomina.empleado_nombre || "MARCO BAEZA"}</p>
            </div>
          </div>

          {/* Información adicional compacta */}
          <div className="text-xs text-center mt-2 text-gray-600">
            <p>Documento generado electrónicamente</p>
          </div>
        </div>
      </div>
    </div>
  );
});

ReciboNominaPrint.displayName = "ReciboNominaPrint";