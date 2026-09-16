"use client";

/**
 * Formulaire des paramètres du marchand (§8, §22, §23).
 * Chaque champ influence réellement le produit : les frais et zones de
 * livraison sont appliqués par le serveur lors de la création des commandes,
 * les promotions sont les seules acceptées par l’IA, et le mode détermine
 * si CLOSER répond seul ou propose des brouillons.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Save, Store } from "lucide-react";
import { Panel, PanelHeader, buttonClass } from "@/components/ui";
import { MOROCCAN_CITIES } from "@/lib/ai/tools";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const MODES: { value: string; label: string; description: string }[] = [
  {
    value: "auto",
    label: "Autonome",
    description: "CLOSER répond immédiatement au client, sans validation.",
  },
  {
    value: "semi",
    label: "Validation (recommandé)",
    description: "CLOSER prépare la réponse, vous l’approuvez avant l’envoi.",
  },
  {
    value: "off",
    label: "Désactivé",
    description: "L’IA ne répond pas. Vous gérez toutes les conversations.",
  },
];

export type SettingsPayload = {
  businessInfo?: {
    businessName?: string;
    whatsappNumber?: string;
    instagramHandle?: string;
    address?: string;
    city?: string;
    email?: string;
  };
  deliveryInfo?: {
    deliveryFee?: number;
    freeDeliveryThreshold?: number | null;
    deliveryZones?: string[];
    deliveryTime?: string;
    deliveryPartner?: string;
  };
  promotions?: {
    code?: string;
    discount?: string;
    active?: boolean;
    description?: string;
  }[];
  aiSettings?: {
    mode?: string;
    handoffMode?: string;
    autoAcceptOrders?: boolean;
    toneStyle?: string;
    maxPriceDiscount?: number;
    replyLanguage?: string;
  };
  operatingHours?: Record<string, { start?: string; end?: string; closed?: boolean }>;
};

export function SettingsForm({
  initial,
  merchant,
  canManage,
  aiConfigured,
}: {
  initial: SettingsPayload;
  merchant: { businessName: string; email: string; phone: string | null; timezone: string };
  canManage: boolean;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [business, setBusiness] = useState({
    businessName: initial.businessInfo?.businessName ?? merchant.businessName,
    whatsappNumber: initial.businessInfo?.whatsappNumber ?? merchant.phone ?? "",
    instagramHandle: initial.businessInfo?.instagramHandle ?? "",
    address: initial.businessInfo?.address ?? "",
    city: initial.businessInfo?.city ?? "Casablanca",
    email: initial.businessInfo?.email ?? merchant.email,
  });

  const [delivery, setDelivery] = useState({
    deliveryFee: Number(initial.deliveryInfo?.deliveryFee ?? 30),
    freeDeliveryThreshold: initial.deliveryInfo?.freeDeliveryThreshold ?? null,
    deliveryZones: initial.deliveryInfo?.deliveryZones ?? [],
    deliveryTime: initial.deliveryInfo?.deliveryTime ?? "24-48h",
    deliveryPartner: initial.deliveryInfo?.deliveryPartner ?? "Cathedis",
  });

  const [zoneInput, setZoneInput] = useState("");

  const [promotions, setPromotions] = useState(
    (initial.promotions ?? []).map((promo) => ({
      code: promo.code ?? "",
      discount: promo.discount ?? "0",
      active: promo.active ?? false,
      description: promo.description ?? "",
    })),
  );

  const [ai, setAi] = useState({
    mode: initial.aiSettings?.mode ?? "semi",
    handoffMode: initial.aiSettings?.handoffMode ?? "approval",
    autoAcceptOrders: initial.aiSettings?.autoAcceptOrders ?? false,
    toneStyle: initial.aiSettings?.toneStyle ?? "chaleureux et professionnel",
    maxPriceDiscount: Number(initial.aiSettings?.maxPriceDiscount ?? 10),
    replyLanguage: initial.aiSettings?.replyLanguage ?? "auto",
  });

  const [hours, setHours] = useState(
    DAYS.reduce<Record<string, { start: string; end: string; closed: boolean }>>((accumulator, day, index) => {
      const existing = initial.operatingHours?.[day];
      accumulator[day] = {
        start: existing?.start ?? "09:00",
        end: existing?.end ?? "19:00",
        closed: existing?.closed ?? index >= 5,
      };
      return accumulator;
    }, {}),
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload: SettingsPayload = {
        businessInfo: business,
        deliveryInfo: {
          deliveryFee: Math.round(delivery.deliveryFee * 100),
          freeDeliveryThreshold:
            delivery.freeDeliveryThreshold === null ? null : Math.round(delivery.freeDeliveryThreshold * 100),
          deliveryZones: delivery.deliveryZones,
          deliveryTime: delivery.deliveryTime,
          deliveryPartner: delivery.deliveryPartner,
        },
        promotions: promotions.filter((promo) => promo.code.trim().length > 0),
        aiSettings: {
          ...ai,
          maxPriceDiscount: Math.max(0, Math.min(50, Number(ai.maxPriceDiscount) || 0)),
        },
        operatingHours: hours,
      };

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) throw new Error(json.error?.message ?? "Enregistrement impossible.");

      setSaved(true);
      router.refresh();
      window.setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const addZone = () => {
    const value = zoneInput.trim().replace(/\s+/g, " ");
    if (!value || delivery.deliveryZones.some((zone) => zone.toLowerCase() === value.toLowerCase())) return;
    setDelivery({ ...delivery, deliveryZones: [...delivery.deliveryZones, value] });
    setZoneInput("");
  };

  const disabled = !canManage || saving;

  return (
    <div className="space-y-4 pb-20 sm:pb-0">
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <Store className="h-4 w-4 text-[var(--color-ink-faint)]" strokeWidth={1.8} />
              Boutique
            </span>
          }
          description="Ces informations sont communiquées aux clients par CLOSER."
        />
        <div className="grid gap-3.5 px-4 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="business-name">
              Nom de la boutique
            </label>
            <input
              id="business-name"
              className="field"
              value={business.businessName}
              onChange={(event) => setBusiness({ ...business, businessName: event.target.value })}
              disabled={disabled}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="whatsapp-number">
              Numéro WhatsApp
            </label>
            <input
              id="whatsapp-number"
              className="field font-mono"
              value={business.whatsappNumber}
              onChange={(event) => setBusiness({ ...business, whatsappNumber: event.target.value })}
              placeholder="+212612345678"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="instagram-handle">
              Instagram
            </label>
            <input
              id="instagram-handle"
              className="field"
              value={business.instagramHandle}
              onChange={(event) => setBusiness({ ...business, instagramHandle: event.target.value })}
              placeholder="@votre_boutique"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="business-email">
              E-mail
            </label>
            <input
              id="business-email"
              type="email"
              className="field"
              value={business.email}
              onChange={(event) => setBusiness({ ...business, email: event.target.value })}
              disabled={disabled}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="business-city">
              Ville
            </label>
            <input
              id="business-city"
              className="field"
              list="cities-settings"
              value={business.city}
              onChange={(event) => setBusiness({ ...business, city: event.target.value })}
              disabled={disabled}
            />
            <datalist id="cities-settings">
              {MOROCCAN_CITIES.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </div>

          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="business-address">
              Adresse (facultatif)
            </label>
            <input
              id="business-address"
              className="field"
              value={business.address}
              onChange={(event) => setBusiness({ ...business, address: event.target.value })}
              disabled={disabled}
            />
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Livraison"
          description="Appliqués automatiquement par le serveur au calcul de chaque commande."
        />
        <div className="grid gap-3.5 px-4 py-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="delivery-fee">
              Frais de livraison par défaut (DH)
            </label>
            <input
              id="delivery-fee"
              type="number"
              min={0}
              step="0.5"
              className="field"
              value={delivery.deliveryFee}
              onChange={(event) => setDelivery({ ...delivery, deliveryFee: Number(event.target.value) || 0 })}
              disabled={disabled}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="free-threshold">
              Livraison offerte à partir de (DH)
            </label>
            <input
              id="free-threshold"
              type="number"
              min={0}
              step="10"
              className="field"
              value={delivery.freeDeliveryThreshold ?? ""}
              onChange={(event) =>
                setDelivery({
                  ...delivery,
                  freeDeliveryThreshold: event.target.value === "" ? null : Number(event.target.value),
                })
              }
              placeholder="Aucun seuil"
              disabled={disabled}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="delivery-time">
              Délai annoncé
            </label>
            <input
              id="delivery-time"
              className="field"
              value={delivery.deliveryTime}
              onChange={(event) => setDelivery({ ...delivery, deliveryTime: event.target.value })}
              disabled={disabled}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="delivery-partner">
              Transporteur habituel
            </label>
            <input
              id="delivery-partner"
              className="field"
              value={delivery.deliveryPartner}
              onChange={(event) => setDelivery({ ...delivery, deliveryPartner: event.target.value })}
              disabled={disabled}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="zone-input">
              Zones desservies
            </label>
            <div className="flex gap-2">
              <input
                id="zone-input"
                className="field flex-1"
                list="cities-zones"
                value={zoneInput}
                onChange={(event) => setZoneInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addZone();
                  }
                }}
                placeholder="Casablanca, Rabat, Marrakech…"
                disabled={disabled}
              />
              <button
                type="button"
                onClick={addZone}
                disabled={disabled || !zoneInput.trim()}
                className={`${buttonClass("secondary", "md")} shrink-0 cursor-pointer`}
              >
                Ajouter
              </button>
            </div>
            <datalist id="cities-zones">
              {MOROCCAN_CITIES.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
            {delivery.deliveryZones.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {delivery.deliveryZones.map((zone) => (
                  <span
                    key={zone}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-0.5 text-[var(--text-xs)] text-[var(--color-ink-secondary)]"
                  >
                    {zone}
                    {!disabled ? (
                      <button
                        type="button"
                        onClick={() =>
                          setDelivery({
                            ...delivery,
                            deliveryZones: delivery.deliveryZones.filter((item) => item !== zone),
                          })
                        }
                        className="cursor-pointer text-[var(--color-ink-faint)] transition hover:text-[var(--color-negative)]"
                        aria-label={`Retirer ${zone}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : (
              <p className="field-hint">
                Vide = livraison partout au Maroc au tarif par défaut.
              </p>
            )}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Codes promo"
          description="CLOSER n’applique que les codes listés ici. Il n’invente jamais de réduction."
        />
        <div className="px-4 py-4">
          {promotions.length > 0 ? (
            <div className="mb-3 space-y-2">
              {promotions.map((promo, index) => (
                <div key={`${promo.code}-${index}`} className="flex flex-wrap items-end gap-2">
                  <div className="w-[130px]">
                    <label className="field-label" htmlFor={`promo-code-${index}`}>
                      Code
                    </label>
                    <input
                      id={`promo-code-${index}`}
                      className="field font-mono"
                      value={promo.code}
                      onChange={(event) => {
                        const next = [...promotions];
                        next[index] = { ...promo, code: event.target.value.toUpperCase() };
                        setPromotions(next);
                      }}
                      disabled={disabled}
                    />
                  </div>
                  <div className="w-[150px]">
                    <label className="field-label" htmlFor={`promo-discount-${index}`}>
                      Réduction
                    </label>
                    <input
                      id={`promo-discount-${index}`}
                      className="field"
                      value={promo.discount}
                      onChange={(event) => {
                        const next = [...promotions];
                        next[index] = { ...promo, discount: event.target.value };
                        setPromotions(next);
                      }}
                      placeholder="10% ou 50 DH"
                      disabled={disabled}
                    />
                  </div>
                  <div className="min-w-[180px] flex-1">
                    <label className="field-label" htmlFor={`promo-desc-${index}`}>
                      Description (facultatif)
                    </label>
                    <input
                      id={`promo-desc-${index}`}
                      className="field"
                      value={promo.description}
                      onChange={(event) => {
                        const next = [...promotions];
                        next[index] = { ...promo, description: event.target.value };
                        setPromotions(next);
                      }}
                      placeholder="Valable sur tout le site"
                      disabled={disabled}
                    />
                  </div>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={promo.active}
                      onChange={(event) => {
                        const next = [...promotions];
                        next[index] = { ...promo, active: event.target.checked };
                        setPromotions(next);
                      }}
                      disabled={disabled}
                    />
                    <span className="toggle-track" aria-hidden="true">
                      <span className="toggle-thumb" />
                    </span>
                    <span className="text-[var(--text-xs)] text-[var(--color-ink-secondary)]">Active</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPromotions(promotions.filter((_, item) => item !== index))}
                    disabled={disabled}
                    className={`${buttonClass("danger", "sm")} cursor-pointer`}
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-[var(--text-sm)] text-[var(--color-ink-muted)]">
              Aucun code promo. Les demandes de réduction seront refusées poliment par CLOSER.
            </p>
          )}

          {!disabled ? (
            <button
              type="button"
              onClick={() =>
                setPromotions([
                  ...promotions,
                  { code: "", discount: "10%", active: true, description: "" },
                ])
              }
              className={`${buttonClass("secondary", "sm")} cursor-pointer`}
            >
              Ajouter un code
            </button>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-[var(--color-ink-faint)]" strokeWidth={1.8} />
              Comportement de CLOSER
            </span>
          }
          description="Détermine si l’IA répond seule ou propose des brouillons à valider."
        />
        <div className="space-y-4 px-4 py-4">
          {!aiConfigured ? (
            <p className="rounded-[var(--radius-md)] border border-[#fde68a] bg-[var(--color-warning-soft)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-warning)]">
              Clé API Gemini non configurée : CLOSER ne peut pas générer de réponses.
              Ajoutez <code className="font-mono">GEMINI_API_KEY</code> dans vos variables
              d’environnement Vercel.
            </p>
          ) : null}

          <div className="space-y-2">
            <span className="field-label">Mode de réponse</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const handoffMode =
                      mode.value === "auto" ? "ai" : mode.value === "semi" ? "approval" : "manual";
                    setAi({ ...ai, mode: mode.value, handoffMode });
                  }}
                  className={`cursor-pointer rounded-[var(--radius-md)] border p-3 text-left transition ${
                    ai.mode === mode.value
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                      : "border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-line-strong)]"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="block text-[var(--text-sm)] font-medium text-[var(--color-ink)]">
                    {mode.label}
                  </span>
                  <span className="mt-1 block text-[var(--text-xs)] leading-[1.45] text-[var(--color-ink-muted)]">
                    {mode.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="reply-language">
                Langue des réponses
              </label>
              <select
                id="reply-language"
                className="field"
                value={ai.replyLanguage}
                onChange={(event) => setAi({ ...ai, replyLanguage: event.target.value })}
                disabled={disabled}
              >
                <option value="auto">Automatique (langue du client)</option>
                <option value="fr">Français</option>
                <option value="ar">Arabe</option>
                <option value="darija">Darija marocaine</option>
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="tone-style">
                Ton
              </label>
              <input
                id="tone-style"
                className="field"
                value={ai.toneStyle}
                onChange={(event) => setAi({ ...ai, toneStyle: event.target.value })}
                placeholder="chaleureux et professionnel"
                disabled={disabled}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="max-discount">
                Remise maximale autorisée (%)
              </label>
              <input
                id="max-discount"
                type="number"
                min={0}
                max={50}
                className="field"
                value={ai.maxPriceDiscount}
                onChange={(event) => setAi({ ...ai, maxPriceDiscount: Number(event.target.value) })}
                disabled={disabled}
              />
              <p className="field-hint">
                0 = aucune remise hors codes promo enregistrés.
              </p>
            </div>

            <div className="flex items-end pb-1">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={ai.autoAcceptOrders}
                  onChange={(event) => setAi({ ...ai, autoAcceptOrders: event.target.checked })}
                  disabled={disabled}
                />
                <span className="toggle-track" aria-hidden="true">
                  <span className="toggle-thumb" />
                </span>
                <span className="text-[var(--text-sm)] text-[var(--color-ink-secondary)]">
                  Passer automatiquement les commandes en « confirmée »
                </span>
              </label>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Heures d’ouverture"
          description="Utilisées pour annoncer les délais et éviter les relances la nuit."
        />
        <div className="px-4 py-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {DAYS.map((day) => (
              <div
                key={day}
                className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-2.5 py-2"
              >
                <span className="w-9 text-[var(--text-sm)] font-medium text-[var(--color-ink)]">{day}</span>
                <input
                  type="time"
                  className="field h-8 flex-1 px-2 text-[var(--text-xs)]"
                  value={hours[day].start}
                  onChange={(event) =>
                    setHours({ ...hours, [day]: { ...hours[day], start: event.target.value } })
                  }
                  disabled={disabled || hours[day].closed}
                  aria-label={`Heure d’ouverture ${day}`}
                />
                <span className="text-[var(--text-xs)] text-[var(--color-ink-faint)]">—</span>
                <input
                  type="time"
                  className="field h-8 flex-1 px-2 text-[var(--text-xs)]"
                  value={hours[day].end}
                  onChange={(event) =>
                    setHours({ ...hours, [day]: { ...hours[day], end: event.target.value } })
                  }
                  disabled={disabled || hours[day].closed}
                  aria-label={`Heure de fermeture ${day}`}
                />
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={hours[day].closed}
                    onChange={(event) =>
                      setHours({ ...hours, [day]: { ...hours[day], closed: event.target.checked } })
                    }
                    disabled={disabled}
                  />
                  <span className="toggle-track" aria-hidden="true">
                    <span className="toggle-thumb" />
                  </span>
                  <span className="sr-only">Fermé le {day}</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {error ? (
        <p className="rounded-[var(--radius-md)] border border-[#fecaca] bg-[var(--color-negative-soft)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-negative)]">
          {error}
        </p>
      ) : null}

      {!canManage ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-ink-muted)]">
          Seuls le propriétaire et les administrateurs peuvent modifier les paramètres.
        </p>
      ) : null}

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)]/95 px-4 py-3 shadow-[var(--shadow-md)] backdrop-blur">
        <p className="meta-label">
          {saved ? "Paramètres enregistrés." : "Les modifications s’appliquent immédiatement aux prochaines conversations."}
        </p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={disabled}
          className={`${buttonClass("primary", "md")} cursor-pointer`}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" strokeWidth={1.8} />}
          Enregistrer
        </button>
      </div>
    </div>
  );
}
