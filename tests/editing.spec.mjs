import { test, expect } from "@playwright/test";
test("edita vértices e sensores, confirma eliminações e preserva dados após importar", async ({
  page,
}) => {
  await page.goto("http://localhost:5175");
  await page.getByRole("button", { name: "Explorações", exact: true }).click();
  await page
    .getByRole("button", { name: "Ver exploração", exact: true })
    .first()
    .click();
  await page.route("https://api.open-meteo.com/**", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.getByRole("button", { name: "Consultar Open-Meteo" }).click();
  await expect(
    page.getByText(/Meteorologia externa indisponível/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar no mapa", exact: true })
    .click();
  await page.waitForTimeout(1300);
  await page
    .getByRole("button", { name: "Editar limites", exact: true })
    .click();
  await expect(page.locator(".vertex")).toHaveCount(4);
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("conte-agro-v1")),
  );
  const vertex = await page.locator(".vertex").first().boundingBox();
  await page.mouse.move(vertex.x + 6, vertex.y + 6);
  await page.mouse.down();
  await page.mouse.move(vertex.x - 12, vertex.y + 15, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const sensor = page.locator(".map-pin.sensor").first();
  const sb = await sensor.boundingBox();
  await page.mouse.move(sb.x + 12, sb.y + 12);
  await page.mouse.down();
  await page.mouse.move(sb.x + 24, sb.y + 18, { steps: 8 });
  await page.mouse.up();
  await page
    .getByRole("button", { name: "Guardar exploração", exact: true })
    .click();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("conte-agro-v1")),
  );
  expect(after.lands[0].geometry).not.toEqual(before.lands[0].geometry);
  expect(after.devices[0].location).not.toEqual(before.devices[0].location);
  await page
    .getByRole("button", { name: "Editar no mapa", exact: true })
    .click();
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Eliminar parcela", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Eliminar parcela", exact: true }),
  ).toHaveCount(2);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Eliminar parcela", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Eliminar parcela", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Guardar exploração", exact: true })
    .click();
  await page.getByRole("button", { name: "Explorações", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar GeoJSON", exact: true })
    .click();
  const dl = await downloadPromise;
  const path = await dl.path();
  page.once("dialog", (d) => d.accept());
  await page.locator("input[type=file]").setInputFiles(path);
  await expect(page.getByRole("status")).toContainText("importados");
  expect(
    (
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("conte-agro-v1")),
      )
    ).parcels,
  ).toHaveLength(4);
  const tick = await page.evaluate(
    () => JSON.parse(localStorage.getItem("conte-agro-v1")).tick,
  );
  await page
    .getByRole("button", { name: "Simular atualização", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("conte-agro-v1")).tick,
    ),
  ).toBe(tick + 1);
});
