import { test, expect } from "@playwright/test";
test("criação geográfica, persistência, filtros, perfis e mobile", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("Worker"))
      errors.push(m.text());
  });
  page.on("dialog", (d) => d.accept());
  await page.goto("http://localhost:5175");
  await page.waitForSelector("canvas");
  await page.waitForTimeout(2500);
  await page
    .getByRole("button", { name: "Nova exploração", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nome da exploração" })
    .fill("Quinta de Teste");
  await page.getByRole("button", { name: "Continuar para o mapa" }).click();
  await page.waitForTimeout(1600);
  const canvas = page.locator("canvas");
  const b = await canvas.boundingBox();
  const pt = (x, y) => ({ x: b.x + b.width * x, y: b.y + b.height * y });
  async function polygon(coords) {
    for (const [x, y] of coords) await page.mouse.click(pt(x, y).x, pt(x, y).y);
    await page.getByRole("button", { name: "Concluir", exact: true }).click();
  }
  await polygon([
    [0.27, 0.24],
    [0.75, 0.24],
    [0.75, 0.72],
    [0.27, 0.72],
  ]);
  await expect(
    page.getByRole("button", { name: "Terreno 1", exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Parcela", exact: true }).click();
    const x = 0.3 + i * 0.14;
    await polygon([
      [x, 0.3],
      [x + 0.11, 0.3],
      [x + 0.11, 0.57],
      [x, 0.57],
    ]);
    await page
      .getByRole("textbox", { name: "Nome da parcela" })
      .fill("Parcela teste " + (i + 1));
    await page
      .getByRole("combobox", { name: "Cultura", exact: true })
      .selectOption(["Vinha", "Banana", "Hortícolas"][i]);
    await page
      .getByRole("button", { name: "Guardar parcela", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Sensor", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nome", exact: true })
    .fill("Sensor de teste");
  await page.getByRole("button", { name: "Colocar no mapa" }).click();
  await page.mouse.click(pt(0.35, 0.4).x, pt(0.35, 0.4).y);
  await page.screenshot({
    path: ".context/editor-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Guardar exploração", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Quinta de Teste", exact: true }),
  ).toBeVisible();
  let stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("conte-agro-v1")),
  );
  expect(stored.farms).toHaveLength(4);
  expect(stored.parcels).toHaveLength(8);
  expect(stored.devices.at(-1).parcelId).toBeTruthy();
  await page.reload();
  await page.getByRole("button", { name: "Explorações", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Quinta de Teste", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sensores", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Pesquisar", exact: true })
    .fill("Sensor de teste");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator("tbody tr").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  for (const tab of ["Estações", "Alertas", "Analytics", "Parceiros"]) {
    await page
      .locator("nav")
      .getByRole("button", { name: new RegExp("^" + tab) })
      .click();
    await expect(page.locator("h1")).toBeVisible();
  }
  await page
    .getByRole("combobox", { name: "Perfil demonstrativo" })
    .selectOption("Agricultor");
  await page.getByRole("button", { name: "Explorações", exact: true }).click();
  await expect(page.locator(".farm-card")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Perfil demonstrativo" })
    .selectOption("Administrador");
  await page.getByRole("button", { name: "Mapa", exact: true }).first().click();
  await page
    .getByRole("combobox", { name: "Município", exact: true })
    .selectOption("Calheta");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.locator(".stat-number").first()).toContainText("1");
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.screenshot({ path: ".context/map-tested.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: ".context/map-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Explorações", exact: true }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: ".context/farms-mobile.png", fullPage: true });
  console.log(
    JSON.stringify({
      passed:
        "create land + 3 parcels + sensor + save + reload + search + navigation + profile + municipality + mobile",
      errors,
    }),
  );
  expect(errors).toEqual([]);
});
