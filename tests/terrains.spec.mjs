import { test, expect } from "@playwright/test";
test("um terreno contém duas explorações independentes com sensores isolados", async ({
  page,
}) => {
  await page.goto("http://localhost:5175");
  await page.getByRole("button", { name: "Terrenos", exact: true }).click();
  await page.getByRole("button", { name: "Novo terreno", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nome do terreno", exact: true })
    .fill("Terreno partilhado");
  await expect(page.locator(".map-wrapper")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 30000 },
  );
  await page.waitForTimeout(300);
  const b = await page.locator("canvas").boundingBox();
  async function draw(coords) {
    for (const [x, y] of coords)
      await page.mouse.click(b.x + b.width * x, b.y + b.height * y);
    await page.getByRole("button", { name: "Concluir", exact: true }).click();
  }
  await draw([
    [0.2, 0.22],
    [0.8, 0.22],
    [0.8, 0.76],
    [0.2, 0.76],
  ]);
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Desenhar exploração", exact: true })
      .click();
    const x = 0.25 + i * 0.28;
    await draw([
      [x, 0.3],
      [x + 0.2, 0.3],
      [x + 0.2, 0.62],
      [x, 0.62],
    ]);
    await page
      .getByRole("textbox", { name: "Nome da exploração *", exact: true })
      .fill(["Vinhas da Ana", "Horta do João"][i]);
    await page
      .getByRole("textbox", { name: "Responsável *", exact: true })
      .fill(["Ana Silva", "João Costa"][i]);
    await page
      .getByRole("combobox", { name: "Organização da exploração" })
      .selectOption(["o1", "o2"][i]);
    await page
      .getByRole("button", { name: "Guardar exploração independente" })
      .click();
  }
  await page
    .getByRole("button", { name: "Guardar terreno", exact: true })
    .click();
  await expect(page.locator(".terrain-farm")).toHaveCount(2);
  await page.screenshot({
    path: ".context/independent-farms.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await expect(
    page.getByRole("combobox", { name: "Perfil demonstrativo" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: ".context/independent-farms-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1512, height: 982 });
  let state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("conte-agro-v1")),
  );
  const land = state.lands.find((l) => l.name === "Terreno partilhado");
  const farms = state.farms.filter((f) => f.landId === land.id);
  expect(farms).toHaveLength(2);
  expect(farms.map((f) => f.responsible)).toEqual(["Ana Silva", "João Costa"]);
  await page
    .getByRole("button", { name: "Culturas e sensores", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Editar no mapa", exact: true })
    .click();
  await expect(page.locator(".map-wrapper")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 30000 },
  );
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Parcela", exact: true }).click();
  const parcelCanvas = await page.locator("canvas").boundingBox();
  for (const [x, y] of [
    [0.45, 0.45],
    [0.55, 0.45],
    [0.55, 0.55],
    [0.45, 0.55],
  ])
    await page.mouse.click(
      parcelCanvas.x + parcelCanvas.width * x,
      parcelCanvas.y + parcelCanvas.height * y,
    );
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nome da parcela" })
    .fill("Vinha exclusiva Ana");
  await page
    .getByRole("button", { name: "Guardar parcela", exact: true })
    .click();
  await page.getByRole("button", { name: "Sensor", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nome", exact: true })
    .fill("Sensor exclusivo Ana");
  await page.getByRole("button", { name: "Colocar no mapa" }).click();
  const c = await page.locator("canvas").boundingBox();
  await page.mouse.click(c.x + c.width * 0.5, c.y + c.height * 0.5);
  await page
    .getByRole("button", { name: "Guardar exploração", exact: true })
    .click();
  await expect(page.locator("tbody")).toContainText("Sensor exclusivo Ana");
  await page.reload();
  await page.getByRole("button", { name: "Terrenos", exact: true }).click();
  const card = page
    .locator(".terrain-card")
    .filter({ hasText: "Terreno partilhado" });
  await card.getByRole("button", { name: "Ver terreno" }).click();
  await page
    .locator(".terrain-farm")
    .filter({ hasText: "Horta do João" })
    .getByRole("button", { name: "Culturas e sensores" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Horta do João", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sensor exclusivo Ana", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Perfil demonstrativo" })
    .selectOption("Empresa agrícola");
  await page.getByRole("button", { name: "Explorações", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Horta do João", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Vinhas da Ana", exact: true }),
  ).toHaveCount(0);
});
