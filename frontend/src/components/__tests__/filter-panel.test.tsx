import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, vi } from "vitest";
import * as React from "react";

import FilterPanel from "../filter-panel";
import type { ItemListResponse } from "@/lib/api";

type Filters = ItemListResponse["filters"];
type Selected = ItemListResponse["selected"];

defineGlobalCrypto();

const routerReplaceMock = vi.fn();
let currentSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (target: string, options?: { scroll?: boolean }) => {
      routerReplaceMock(target, options);
      if (typeof target === "string") {
        const [, query] = target.split("?");
        currentSearch = new URLSearchParams(query ?? "");
      }
    },
  }),
  usePathname: () => "/search",
  useSearchParams: () => ({
    toString: () => currentSearch.toString(),
    getAll: (key: string) => currentSearch.getAll(key),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function defineGlobalCrypto() {
  if (typeof globalThis.crypto === "undefined" ||
      typeof globalThis.crypto.randomUUID !== "function") {
    const randomUUID = () => "test-uuid";
    globalThis.crypto = { randomUUID } as Crypto;
  }
}

async function flushTransitions() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function ensureSectionOpen(
  user: ReturnType<typeof userEvent.setup>,
  contentId: string
): Promise<HTMLElement> {
  const content = document.getElementById(contentId);
  expect(content).not.toBeNull();

  const fieldset = content?.closest("fieldset") as HTMLElement | null;
  expect(fieldset).not.toBeNull();

  const toggle =
    fieldset?.querySelector<HTMLButtonElement>(`button[aria-controls='${contentId}']`) ??
    fieldset?.querySelector<HTMLButtonElement>("button[aria-label*='options']");
  expect(toggle).not.toBeNull();

  const shouldOpen =
    toggle?.getAttribute("aria-expanded") === "false" ||
    toggle?.getAttribute("aria-label")?.includes("Expand options");

  if (shouldOpen && toggle) {
    await user.click(toggle);
  }

  return fieldset as HTMLElement;
}

const filters: Filters = {
  brands: [
    {
      slug: "hermes",
      name: "Hermès",
      selected: false,
      item_count: 21,
      country: "France",
    },
    {
      slug: "gucci",
      name: "Gucci",
      selected: false,
      item_count: 18,
      country: "Italy",
    },
  ],
  categories: [
    {
      id: "dresses",
      name: "Dresses",
      selected: false,
      item_count: 12,
      subcategories: [
        {
          id: "evening",
          name: "Evening Dress",
          selected: false,
          item_count: 4,
          type: "Occasion",
        },
      ],
    },
  ],
  styles: [
    {
      slug: "couture",
      name: "Couture",
      selected: false,
      item_count: 5,
      substyles: [
        {
          slug: "haute",
          name: "Haute",
          selected: false,
          item_count: 2,
        },
      ],
    },
  ],
  tags: [
    {
      id: "lace",
      name: "Lace",
      selected: false,
      type: "Detail",
      item_count: 3,
    },
  ],
  colors: [
    {
      id: "red",
      name: "Red",
      selected: false,
      hex: "#ff0000",
      item_count: 6,
    },
  ],
  collections: [
    {
      id: "ss24",
      name: "SS24",
      selected: false,
      brand_slug: "hermes",
      year: 2024,
    },
  ],
  fabrics: [
    {
      id: "silk",
      name: "Silk",
      selected: false,
      type: "Natural",
      item_count: 8,
    },
  ],
  features: [
    {
      id: "pleats",
      name: "Pleats",
      selected: false,
      item_count: 4,
      category: "Construction",
    },
  ],
  measurements: [
    {
      field: "bust_cm",
      label: "Bust",
      unit: "cm",
      min: 70,
      max: 110,
    },
  ],
  release_year: {
    min: 2020,
    max: 2024,
  },
  prices: {
    currency: "USD",
    min: 100,
    max: 1000,
  },
};

const emptySelected: Selected = {
  q: null,
  brand: [],
  category: [],
  subcategory: [],
  style: [],
  substyle: [],
  tag: [],
  color: [],
  collection: [],
  fabric: [],
  feature: [],
  measurement: {
    bust_min: null,
    bust_max: null,
    waist_min: null,
    waist_max: null,
    hip_min: null,
    hip_max: null,
    length_min: null,
    length_max: null,
  },
  release_year_ranges: [],
  price_currency: null,
  price_ranges: [],
};

function renderPanel(selected: Selected = emptySelected) {
  render(<FilterPanel filters={filters} selected={selected} query={undefined} />);
}

beforeEach(() => {
  currentSearch = new URLSearchParams();
  routerReplaceMock.mockClear();
});

describe("FilterPanel", () => {
  it("applies brand filters and updates the URL query", async () => {
    renderPanel();
    const user = userEvent.setup();

  await ensureSectionOpen(user, "brand-content");
  await user.click(await screen.findByRole("button", { name: /Hermès/ }));

    await flushTransitions();
    expect(routerReplaceMock.mock.calls).toContainEqual(["/search?brand=hermes", { scroll: false }]);
  });

  it("supports hierarchical parent and child selections", async () => {
    renderPanel();
    const user = userEvent.setup();

  await ensureSectionOpen(user, "category-content");
    await user.click(screen.getByRole("button", { name: /Dresses/ }));
    await flushTransitions();
    expect(routerReplaceMock.mock.calls).toContainEqual(["/search?category=dresses", { scroll: false }]);

    await ensureSectionOpen(user, "category-content");
    await user.click(screen.getByRole("button", { name: /Evening Dress/ }));
    await flushTransitions();
    expect(routerReplaceMock.mock.calls).toContainEqual([
      "/search?category=dresses&subcategory=evening",
      { scroll: false },
    ]);
  });

  it("renders color swatches and toggles color filters", async () => {
    renderPanel();
    const user = userEvent.setup();

  await ensureSectionOpen(user, "colors-content");

    const swatch = screen.getByRole("button", { name: /Red/ }).querySelector("span[aria-hidden='true']");
    expect(swatch).not.toBeNull();
  expect(swatch).toHaveStyle({ backgroundColor: "rgb(255, 0, 0)" });

    await user.click(screen.getByRole("button", { name: /Red/ }));
    await flushTransitions();
    expect(routerReplaceMock.mock.calls).toContainEqual(["/search?color=red", { scroll: false }]);
  });

  it("updates measurement parameters when inputs change", async () => {
    renderPanel();
    const user = userEvent.setup();

    const measurementsFieldset = await ensureSectionOpen(user, "measurements-content");

    const minInput = within(measurementsFieldset).getByLabelText("Min") as HTMLInputElement;
    await user.clear(minInput);
    await user.type(minInput, "85");

    await flushTransitions();
    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    const formData = new FormData(form as HTMLFormElement);
    expect(formData.get("measurement_bust_min")).toBe("85");
  });

  it("commits release year ranges as they are edited", async () => {
    renderPanel();
    const user = userEvent.setup();

    const releaseFieldset = await ensureSectionOpen(user, "release-years-content");

    const minYearInput = within(releaseFieldset).getByLabelText("Min year") as HTMLInputElement;
    await user.clear(minYearInput);
    await user.type(minYearInput, "2021");

    await flushTransitions();
    const form = document.querySelector("form");
    expect(form).not.toBeNull();
  const releaseFormData = new FormData(form as HTMLFormElement);
  const releaseValues = releaseFormData.getAll("release_year_range");
    expect(releaseValues).toContain("2021:2024");
  });

  it("commits price ranges including currency", async () => {
    renderPanel();
    const user = userEvent.setup();

    const priceFieldset = await ensureSectionOpen(user, "prices-content");

    const minPriceInput = within(priceFieldset).getByLabelText("Min price") as HTMLInputElement;
    await user.clear(minPriceInput);
    await user.type(minPriceInput, "250");

    await flushTransitions();
    const form = document.querySelector("form");
    expect(form).not.toBeNull();
  const priceFormData = new FormData(form as HTMLFormElement);
  const priceValues = priceFormData.getAll("price_range");
    expect(priceValues).toContain("USD:250:");
  });

  it("supports adding multiple release year ranges", async () => {
    renderPanel();
    const user = userEvent.setup();

    const releaseFieldset = await ensureSectionOpen(user, "release-years-content");

    const [firstMinInput] = within(releaseFieldset).getAllByLabelText("Min year");
    await user.clear(firstMinInput);
    await user.type(firstMinInput, "2020");
    await flushTransitions();

    await user.click(within(releaseFieldset).getByRole("button", { name: /Add range/i }));

    const minInputs = within(releaseFieldset).getAllByLabelText("Min year");
    expect(minInputs).toHaveLength(2);
    const secondMinInput = minInputs[1] as HTMLInputElement;
    await user.type(secondMinInput, "2022");

    await flushTransitions();

    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    const releaseFormData = new FormData(form as HTMLFormElement);
    const releaseValues = releaseFormData.getAll("release_year_range");
    expect(releaseValues).toContain("2020:2024");
    expect(releaseValues).toContain("2022:2024");
  });

  it("removes price ranges and clears committed values", async () => {
    renderPanel();
    const user = userEvent.setup();

    const priceFieldset = await ensureSectionOpen(user, "prices-content");

    const minPriceInput = within(priceFieldset).getByLabelText("Min price") as HTMLInputElement;
    await user.clear(minPriceInput);
    await user.type(minPriceInput, "250");
    await flushTransitions();

    await user.click(within(priceFieldset).getByTitle("Remove range"));

    await flushTransitions();

    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    const priceFormData = new FormData(form as HTMLFormElement);
    expect(priceFormData.getAll("price_range")).toHaveLength(0);
    expect(form?.querySelector('input[name="price_currency"]')).toBeNull();
    expect(currentSearch.getAll("price_range")).toHaveLength(0);
    expect(currentSearch.get("price_currency")).toBeNull();
  });

  it("filters options based on search input", async () => {
    renderPanel();
    const user = userEvent.setup();

    const brandFieldset = await ensureSectionOpen(user, "brand-content");

    const input = within(brandFieldset).getByPlaceholderText("Search brands");
    await user.type(input, "Gucci");

    expect(screen.getByRole("button", { name: /Gucci/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hermès/ })).not.toBeInTheDocument();
  });
});
