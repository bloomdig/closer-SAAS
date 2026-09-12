"use client";
import { useState } from "react";

export function ROICalculator() {
  const [conv, setConv] = useState(500);
  const [orders, setOrders] = useState(45);
  const [aov, setAov] = useState(350);
  const [conversion, setConversion] = useState(9);
  const [refusal, setRefusal] = useState(30);

  const currentRevenue = orders * aov;
  const improvedConv = Math.min(30, conversion + 12);
  const improvedRefusal = Math.max(5, refusal - 15);
  const improvedOrders = Math.round(conv * (improvedConv / 100));
  const improvedRevenue = improvedOrders * aov;
  const improvement = Math.round(((improvedRevenue - currentRevenue) / currentRevenue) * 100);
  const extraRevenue = improvedRevenue - currentRevenue;

  const fields: { label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; suffix?: string }[] = [
    { label: "Conversations mensuelles", value: conv, set: setConv, min: 50, max: 5000, step: 50 },
    { label: "Commandes mensuelles", value: orders, set: setOrders, min: 1, max: 1000, step: 1 },
    { label: "Panier moyen (DH)", value: aov, set: setAov, min: 50, max: 2000, step: 25, suffix: " DH" },
    { label: "Taux de conversion (%)", value: conversion, set: setConversion, min: 1, max: 100, step: 1, suffix: "%" },
    { label: "Taux de refus (%)", value: refusal, set: setRefusal, min: 1, max: 80, step: 1, suffix: "%" },
  ];

  return (
    <section className="bg-[#fafafa] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#c2185b]">Calculateur de retour</span>
          <h2 className="mt-4 text-[32px] font-extrabold tracking-[-0.03em] leading-[1.1] text-[#0a0a0a] md:text-[42px]">Estimez votre hausse de revenus.</h2>
          <p className="mt-5 text-[16px] leading-[1.65] text-[#6b6b6b]">Voyez comment des réponses plus rapides, un meilleur taux de conversion et des confirmations COD pourraient faire croître votre activité.</p>
        </div>

        <div className="mx-auto mt-14 max-w-3xl rounded-[24px] border border-[#eaeaea] bg-white p-8 md:p-10 shadow-[0_24px_60px_rgba(0,0,0,0.06)]">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
            {fields.map((f) => (
              <div key={f.label}>
                <label className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a]">{f.label}</label>
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={f.value}
                  onChange={(e) => f.set(Number(e.target.value))}
                  className="mt-3 h-1 w-full appearance-none rounded-full bg-[#eaeaea] accent-[#c2185b] cursor-pointer"
                />
                <div className="mt-2 text-[18px] font-extrabold text-[#0a0a0a] tracking-[-0.02em]">{f.value}{f.suffix || ""}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[#eaeaea] bg-[#fafafa] p-6">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a]">Revenu actuel</p>
              <p className="mt-2 text-[26px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">{currentRevenue.toLocaleString()} DH</p>
            </div>
            <div className="rounded-2xl border border-[#c2185b]/15 bg-[#c2185b]/[0.03] p-6">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#c2185b]">Hausse estimée</p>
              <p className="mt-2 text-[26px] font-extrabold tracking-[-0.03em] text-[#c2185b]">+{improvement}%</p>
            </div>
            <div className="rounded-2xl border border-[#eaeaea] bg-[#fafafa] p-6">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9a9a9a]">Revenu supplémentaire</p>
              <p className="mt-2 text-[26px] font-extrabold tracking-[-0.03em] text-[#0a0a0a]">+{extraRevenue.toLocaleString()} DH</p>
            </div>
          </div>

          <p className="mt-5 text-[11px] text-[#9a9a9a]">* Ces estimations sont basées sur des benchmarks du secteur. Les résultats réels dépendent de votre activité et de votre marché.</p>
        </div>
      </div>
    </section>
  );
}
