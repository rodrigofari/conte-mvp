import { test, expect } from "@playwright/test";
test("ajusta terreno ocupado e associa a mesma exploração a um segundo terreno", async ({
  page,
}) => {
  await page.goto("http://localhost:5175");
  await page
    .getByRole("combobox", { name: "Perfil demonstrativo" })
    .selectOption("Agricultor");
  await page.getByRole("button", { name: "Terrenos", exact: true }).click();
  await page
    .locator(".terrain-card")
    .first()
    .getByRole("button", { name: "Ajustar limites" })
    .click();
  await expect(page.locator(".map-wrapper")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("conte-agro-v1")),
  );
  const v = await page.locator(".vertex").first().boundingBox();
  await page.mouse.move(v.x + 9, v.y + 9);
  await page.mouse.down();
  await page.mouse.move(v.x + 12, v.y + 6, { steps: 8 });
  await page.mouse.up();
  await page
    .getByRole("button", { name: "Guardar terreno", exact: true })
    .click();
  const adjusted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("conte-agro-v1")),
  );
  expect(adjusted.lands[0].geometry).not.toEqual(before.lands[0].geometry);
  expect(adjusted.farms[0].geometry).toEqual(adjusted.lands[0].geometry);
  await page.getByRole("button", { name: "Voltar aos terrenos" }).click();
  await page.getByRole("button", { name: "Novo terreno", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nome do terreno", exact: true })
    .fill("Segundo terreno das Vinhas");
  await expect(page.locator(".map-wrapper")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const b = await page.locator("canvas").boundingBox();
  async function draw(points) {
    for (const [x, y] of points)
      await page.mouse.click(b.x + b.width * x, b.y + b.height * y);
    await page.getByRole("button", { name: "Concluir", exact: true }).click();
  }
  await draw([
    [0.25, 0.25],
    [0.75, 0.25],
    [0.75, 0.72],
    [0.25, 0.72],
  ]);
  await page
    .getByRole("button", { name: "Desenhar exploração", exact: true })
    .click();
  await draw([
    [0.35, 0.35],
    [0.65, 0.35],
    [0.65, 0.62],
    [0.35, 0.62],
  ]);
  await page
    .getByRole("combobox", { name: "Criar ou associar exploração" })
    .selectOption("f1");
  await page
    .getByRole("button", { name: "Guardar exploração independente" })
    .click();
  await page
    .getByRole("button", { name: "Guardar terreno", exact: true })
    .click();
  let d = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("conte-agro-v1")),
  );
  expect(d.farms).toHaveLength(3);
  expect(d.farms[0].additionalLands).toHaveLength(1);
  const lid = d.lands.find((l) => l.name === "Segundo terreno das Vinhas").id;
  expect(d.farms[0].additionalLands[0].landId).toBe(lid);
  await page
    .getByRole("button", { name: "Culturas e sensores", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Editar no mapa", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Terreno selecionado" })
    .selectOption(lid);
  await expect(page.locator(".map-wrapper")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Sensor", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nome", exact: true })
    .fill("Sensor do segundo terreno");
  await page.getByRole("button", { name: "Colocar no mapa" }).click();
  const c = await page.locator("canvas").boundingBox();
  await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
  await page
    .getByRole("button", { name: "Guardar exploração", exact: true })
    .click();
  d = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("conte-agro-v1")),
  );
  expect(d.devices.at(-1).farmId).toBe("f1");
  expect(d.devices.at(-1).landId).toBe(lid);
  await page.reload();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("conte-agro-v1")),
  );
  expect(saved.farms[0].additionalLands).toHaveLength(1);
});
