use crustache::Template as CrustacheTemplate;
use serde_json::Value;
use wasm_bindgen::prelude::*;

const SERIALIZATION_ERROR_PREFIX: &str = "Failed to serialize input data";

const TEMPLATE_COMPILE_ERROR_PREFIX: &str = "Failed to compile template";
const TEMPLATE_RENDER_ERROR_PREFIX: &str = "Failed to render template";

#[wasm_bindgen]
pub struct Template {
    inner: CrustacheTemplate,
}

#[wasm_bindgen]
impl Template {
    #[wasm_bindgen(constructor)]
    pub fn new(template: &str) -> Result<Template, JsValue> {
        let compiled = crustache::compile_str(template)
            .map_err(|error| format_error(TEMPLATE_COMPILE_ERROR_PREFIX, error))?;

        Ok(Template { inner: compiled })
    }

    pub fn render(&self, data: JsValue) -> Result<String, JsValue> {
        let encoded = encode_js_value(data)?;

        self.inner
            .render_data_to_string(&encoded)
            .map_err(|error| format_error(TEMPLATE_RENDER_ERROR_PREFIX, error))
    }
}

#[wasm_bindgen]
pub fn render(template: &str, data: JsValue) -> Result<String, JsValue> {
    let compiled =
        crustache::compile_str(template).map_err(|error| format_error(TEMPLATE_COMPILE_ERROR_PREFIX, error))?;

    let encoded = encode_js_value(data)?;

    compiled
        .render_data_to_string(&encoded)
        .map_err(|error| format_error(TEMPLATE_RENDER_ERROR_PREFIX, error))
}

fn encode_js_value(data: JsValue) -> Result<crustache::Data, JsValue> {
    let json: Value =
        serde_wasm_bindgen::from_value(data).map_err(|error| format_error(SERIALIZATION_ERROR_PREFIX, error))?;

    crustache::to_data(json).map_err(|error| format_error(SERIALIZATION_ERROR_PREFIX, error))
}

fn format_error<E: core::fmt::Display>(prefix: &str, error: E) -> JsValue {
    JsValue::from_str(&format!("{prefix}: {error}"))
}
