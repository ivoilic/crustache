use std::cell::RefCell;
use std::collections::HashMap;
use std::mem;
use std::io::Write;
use std::str;

use crate::compiler::Compiler;
use crate::parser::Token;
use serde::Serialize;

use super::{Context, Data, Error, Result, to_data};

/// `Template` represents a compiled mustache file.
#[derive(Debug, Clone)]
pub struct Template {
    ctx: Context,
    tokens: Vec<Token>,
    partials: HashMap<String, Vec<Token>>,
}

/// Construct a `Template`. This is not part of the impl of Template so it is
/// not exported outside of crustache.
pub fn new(ctx: Context, tokens: Vec<Token>, partials: HashMap<String, Vec<Token>>) -> Template {
    Template {
        ctx: ctx,
        tokens: tokens,
        partials: partials,
    }
}

impl Template {
    /// Compiled token stream for this template (used when a template is supplied as partial data).
    pub(crate) fn compiled_tokens(&self) -> &[Token] {
        &self.tokens
    }

    /// Renders the template with the `Encodable` data.
    pub fn render<W, T>(&self, wr: &mut W, data: &T) -> Result<()>
    where W: Write,
          T: Serialize,
    {
        let data = to_data(data)?;
        self.render_data(wr, &data)
    }

    /// Renders the template with the `Data`.
    pub fn render_data<W: Write>(&self, wr: &mut W, data: &Data) -> Result<()> {
        let mut render_ctx = RenderContext::new(self);
        let mut stack = vec![data];

        render_ctx.render(wr, &mut stack, &self.tokens)
    }

    /// Renders the template to a `String` with the `Encodable` data.
    pub fn render_to_string<T: Serialize>(&self, data: &T) -> Result<String> {
        let mut output = Vec::new();
        self.render(&mut output, data)?;
        String::from_utf8(output).map_err(|_| Error::InvalidStr)
    }

    /// Renders the template to a `String` with the `Data`.
    pub fn render_data_to_string(&self, data: &Data) -> Result<String> {
        let mut output = Vec::new();
        self.render_data(&mut output, data)?;
        String::from_utf8(output).map_err(|_| Error::InvalidStr)
    }
}

struct RenderContext<'a> {
    template: &'a Template,
    indent: String,
    line_start: bool,
    inner_fn2_rendered: bool,
}

impl<'a> RenderContext<'a> {
    fn new(template: &'a Template) -> RenderContext<'a> {
        RenderContext {
            template: template,
            indent: "".to_string(),
            line_start: true,
            inner_fn2_rendered: true,
        }
    }

    fn render<W: Write>(&mut self, wr: &mut W, stack: &mut Vec<&Data>, tokens: &[Token]) -> Result<()> {
        for token in tokens.iter() {
            self.render_token(wr, stack, token)?;
        }

        Ok(())
    }

    fn render_token<W: Write>(&mut self, wr: &mut W, stack: &mut Vec<&Data>, token: &Token) -> Result<()> {
        match *token {
            Token::Text(ref value) => {
                self.render_text(wr, value)
            }
            Token::EscapedTag(ref path, _) => {
                self.render_etag(wr, stack, path)
            }
            Token::UnescapedTag(ref path, _) => {
                self.render_utag(wr, stack, path)
            }
            Token::Section(ref path, true, ref children, _, _, _, _, _) => {
                self.render_inverted_section(wr, stack, path, children)
            }
            Token::Section(ref path, false, ref children, ref otag, _, ref src, _, ref ctag) => {
                self.render_section(wr, stack, path, children, src, otag, ctag)
            }
            Token::Partial(ref name, ref indent, _) => {
                self.render_partial(wr, stack, name, indent)
            }
            Token::IncompleteSection(..) => {
                bug!("render_token should not encounter IncompleteSections");
                Err(Error::IncompleteSection)
            }
        }
    }

    fn write_tracking_newlines<W: Write>(&mut self, wr: &mut W, value: &str) -> Result<()> {
        wr.write_all(value.as_bytes())?;
        self.line_start = match value.chars().last() {
            None => self.line_start, // None == ""
            Some('\n') => true,
            _ => false,
        };

        Ok(())
    }

    fn write_indent<W: Write>(&mut self, wr: &mut W) -> Result<()> {
        if self.line_start {
            wr.write_all(self.indent.as_bytes())?;
        }

        Ok(())
    }

    fn render_text<W: Write>(&mut self, wr: &mut W, value: &str) -> Result<()> {
        // Indent the lines.
        if self.indent.is_empty() {
            return self.write_tracking_newlines(wr, value);
        } else {
            let mut pos = 0;
            let len = value.len();

            while pos < len {
                let v = &value[pos..];
                let line = match v.find('\n') {
                    None => {
                        let line = v;
                        pos = len;
                        line
                    }
                    Some(i) => {
                        let line = &v[..i + 1];
                        pos += i + 1;
                        line
                    }
                };

                if line.as_bytes()[0] != b'\n' {
                    self.write_indent(wr)?;
                }

                self.write_tracking_newlines(wr, line)?;
            }
        }

        Ok(())
    }

    fn render_etag<W: Write>(&mut self, wr: &mut W, stack: &mut Vec<&Data>, path: &[String]) -> Result<()> {
        let mut bytes = vec![];

        self.render_utag(&mut bytes, stack, path)?;

        for b in bytes {
            match b {
                b'<' => wr.write_all(b"&lt;")?,
                b'>' => wr.write_all(b"&gt;")?,
                b'&' => wr.write_all(b"&amp;")?,
                b'"' => wr.write_all(b"&quot;")?,
                b'\'' => wr.write_all(b"&#39;")?,
                _ => wr.write_all(&[b])?,
            }
        }

        Ok(())
    }

    fn render_utag<W: Write>(&mut self, wr: &mut W, stack: &mut Vec<&Data>, path: &[String]) -> Result<()> {
        match self.find(path, stack) {
            None => {}
            Some(value) => {
                self.write_indent(wr)?;

                // Currently this doesn't allow Option<Option<Foo>>, which
                // would be un-nameable in the view anyway, so I'm unsure if it's
                // a real problem. Having {{foo}} render only when `foo = Some(Some(val))`
                // seems unintuitive and may be surprising in practice.
                if let Data::Null = *value {
                    return Ok(());
                }

                match *value {
                    Data::String(ref value) => {
                        self.write_tracking_newlines(wr, value)?;
                    }

                    // etags and utags use the default delimiter.
                    Data::Fun(ref fcell) => {
                        let f = &mut *fcell.borrow_mut();
                        let tokens = self.render_fun("", "{{", "}}", f)?;
                        self.render(wr, stack, &tokens)?;
                    }

                    Data::Fun2(ref fcell) => {
                        self.render_fun2(wr, stack, "", "{{", "}}", fcell)?;
                    }

                    ref value => {
                        bug!("render_utag: unexpected value {:?}", value);
                    }
                }
            }
        };

        Ok(())
    }

    fn render_inverted_section<W: Write>(&mut self,
                                         wr: &mut W,
                                         stack: &mut Vec<&Data>,
                                         path: &[String],
                                         children: &[Token]) -> Result<()> {
        match self.find(path, stack) {
            None => {}
            Some(&Data::Null) => {}
            Some(&Data::Bool(false)) => {}
            Some(&Data::Vec(ref xs)) if xs.is_empty() => {}
            Some(_) => {
                return Ok(());
            }
        }

        self.render(wr, stack, children)
    }

    fn render_section<W: Write>(&mut self,
                                wr: &mut W,
                                stack: &mut Vec<&Data>,
                                path: &[String],
                                children: &[Token],
                                src: &str,
                                otag: &str,
                                ctag: &str) -> Result<()> {
        match self.find(path, stack) {
            None => {}
            Some(value) => {
                match *value {
                    Data::Null => {
                        // do nothing
                    }
                    Data::Bool(true) => self.render(wr, stack, children)?,
                    Data::Bool(false) => (),
                    Data::String(ref val) => {
                        if !val.is_empty() {
                            stack.push(value);
                            self.render(wr, stack, children)?;
                            stack.pop();
                        }
                    }
                    Data::Vec(ref vs) => {
                        for v in vs.iter() {
                            stack.push(v);
                            self.render(wr, stack, children)?;
                            stack.pop();
                        }
                    }
                    Data::Map(_) => {
                        stack.push(value);
                        self.render(wr, stack, children)?;
                        stack.pop();
                    }
                    Data::Fun(ref fcell) => {
                        let f = &mut *fcell.borrow_mut();
                        let tokens = self.render_fun(src, otag, ctag, f)?;
                        self.render(wr, stack, &tokens)?;
                    }
                    Data::Template(_) => {}
                    Data::Fun2(ref fcell) => {
                        self.render_fun2(wr, stack, src, otag, ctag, fcell)?;
                    }
                }
            }
        };

        Ok(())
    }

    fn render_partial<W: Write>(&mut self,
                                wr: &mut W,
                                stack: &mut Vec<&Data>,
                                name: &str,
                                indent: &str) -> Result<()> {
        let from_data = self
            .find(&[name], stack)
            .and_then(|d| match d {
                Data::Template(t) => Some(t.compiled_tokens()),
                _ => None,
            });
        let from_file = self.template.partials.get(name).map(|v| v.as_slice());

        match from_data.or(from_file) {
            None => (),
            Some(tokens) => {
                let mut indent = self.indent.clone() + indent;

                mem::swap(&mut self.indent, &mut indent);
                self.render(wr, stack, tokens)?;
                mem::swap(&mut self.indent, &mut indent);
            }
        }

        Ok(())
    }

    fn render_fun(&self,
                  src: &str,
                  otag: &str,
                  ctag: &str,
                  f: &mut Box<dyn FnMut(String) -> String + Send + 'static>)
                  -> Result<Vec<Token>> {
        let src = f(src.to_string());

        let compiler = Compiler::new_with(self.template.ctx.clone(),
                                          src.chars(),
                                          self.template.partials.clone(),
                                          otag.to_string(),
                                          ctag.to_string());

        let (tokens, _) = compiler.compile()?;
        Ok(tokens)
    }

    fn render_fun2<W: Write>(
        &mut self,
        wr: &mut W,
        stack: &mut Vec<&Data>,
        src: &str,
        otag: &str,
        ctag: &str,
        fcell: &RefCell<Box<dyn FnMut(String, &mut dyn FnMut(String) -> String) -> String + Send>>,
    ) -> Result<()> {
        let f = &mut *fcell.borrow_mut();
        let ctx2 = self.template.ctx.clone();
        let partials2 = self.template.partials.clone();
        self.inner_fn2_rendered = false;

        let mut f0 = |src: String| {
            let compiler = Compiler::new_with(
                ctx2.clone(),
                src.chars(),
                partials2.clone(),
                otag.to_string(),
                ctag.to_string(),
            );
            let mut vw: Vec<u8> = vec![];
            match compiler.compile() {
                Ok((tokens, _)) => {
                    /* a trick to reset the flag is to pass an empty string */
                    self.inner_fn2_rendered = src.len() > 0;
                    let _ = self.render(&mut vw, stack, &tokens);
                }
                _ => (),
            }
            String::from_utf8_lossy(&vw).to_string()
        };
        let out = f(src.to_string(), &mut f0);
        if self.inner_fn2_rendered {
            self.inner_fn2_rendered = false;
            self.render_text(wr, &out)?;
        } else {
            let compiler = Compiler::new_with(
                self.template.ctx.clone(),
                out.chars(),
                self.template.partials.clone(),
                otag.to_string(),
                ctag.to_string(),
            );

            let (tokens, _) = compiler.compile()?;
            self.render(wr, stack, &tokens)?;
        }
        Ok(())
    }

    fn find<'c, P: AsRef<str>>(&self, path: &[P], stack: &mut Vec<&'c Data>) -> Option<&'c Data> {
        // If we have an empty path, we just want the top value in our stack.
        if path.is_empty() {
            match stack.last() {
                None => {
                    return None;
                }
                Some(data) => {
                    return Some(*data);
                }
            }
        }

        // Otherwise, find the stack that has the first part of our path.
        let mut value = None;

        for data in stack.iter().rev() {
            match **data {
                Data::Map(ref m) => {
                    if let Some(v) = m.get(path[0].as_ref()) {
                        value = Some(v);
                        break;
                    }
                }
                _ => { /* continue searching the stack */ },
            }
        }

        // Walk the rest of the path to find our final value.
        let mut value = match value {
            Some(value) => value,
            None => {
                return None;
            }
        };

        for part in path[1..].iter() {
            match *value {
                Data::Map(ref m) => {
                    match m.get(part.as_ref()) {
                        Some(v) => {
                            value = v;
                        }
                        None => {
                            return None;
                        }
                    }
                }
                _ => {
                    return None;
                }
            }
        }

        Some(value)
    }
}
