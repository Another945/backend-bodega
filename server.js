const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
console.log("MYSQLHOST:", process.env.MYSQLHOST);
console.log("MYSQLPORT:", process.env.MYSQLPORT);
console.log("MYSQLDATABASE:", process.env.MYSQLDATABASE);
console.log("MYSQLUSER:", process.env.MYSQLUSER);
const conexion = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

conexion.connect((error) => {
    if (error) {
        console.log('Error conectando a MySQL:', error);
        return;
    }
    console.log('✅ MySQL conectado');
});

// ── Productos ──────────────────────────────────────────────
app.get('/productos', (req, res) => {
    conexion.query('SELECT * FROM productos', (error, resultados) => {
        if (error) return res.status(500).json(error);
        res.json(resultados);
    });
});

app.post('/productos', (req, res) => {
    const { nombre, descripcion, precio, stock, imagen } = req.body;
    conexion.query(
        'INSERT INTO productos(nombre, descripcion, precio, stock, imagen) VALUES (?, ?, ?, ?, ?)',
        [nombre, descripcion, precio, stock, imagen],
        (error) => {
            if (error) return res.status(500).json(error);
            res.json({ mensaje: 'Producto registrado correctamente' });
        }
    );
});

app.put('/productos/:id', (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock, imagen } = req.body;
    conexion.query(
        'UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ?, imagen = ? WHERE id = ?',
        [nombre, descripcion, precio, stock, imagen, id],
        (error) => {
            if (error) return res.status(500).json(error);
            res.json({ mensaje: 'Producto actualizado correctamente' });
        }
    );
});

app.delete('/productos/:id', (req, res) => {
    const { id } = req.params;
    conexion.query(
        'DELETE FROM productos WHERE id = ?',
        [id],
        (error) => {
            if (error) return res.status(500).json(error);
            res.json({ mensaje: 'Producto eliminado correctamente' });
        }
    );
});

app.put('/productos/:id/reponer', (req, res) => {
    const { id } = req.params;
    const { cantidad } = req.body;
    conexion.query(
        'UPDATE productos SET stock = stock + ? WHERE id = ?',
        [cantidad, id],
        (error) => {
            if (error) return res.status(500).json(error);
            res.json({ mensaje: 'Stock repuesto correctamente' });
        }
    );
});

// ── Ventas ─────────────────────────────────────────────────
app.post('/ventas', (req, res) => {
    const { total, productos } = req.body;
    conexion.query(
        'INSERT INTO ventas(total) VALUES (?)',
        [total],
        (error, resultadoVenta) => {
            if (error) return res.status(500).json(error);
            const ventaId = resultadoVenta.insertId;
            productos.forEach(item => {
                const subtotal = item.precio * item.cantidad;
                conexion.query(
                    'INSERT INTO detalle_ventas(venta_id, producto_id, cantidad, precio, subtotal) VALUES (?, ?, ?, ?, ?)',
                    [ventaId, item.id, item.cantidad, item.precio, subtotal]
                );
                conexion.query(
                    'UPDATE productos SET stock = stock - ? WHERE id = ?',
                    [item.cantidad, item.id]
                );
            });
            res.json({ mensaje: 'Venta registrada correctamente' });
        }
    );
});

// ── Merma ──────────────────────────────────────────────────
app.get('/merma', (req, res) => {
    conexion.query('SELECT * FROM merma ORDER BY id DESC', (error, resultados) => {
        if (error) return res.status(500).json(error);
        res.json(resultados);
    });
});

app.post('/merma', (req, res) => {
    const { producto_id, producto, motivo, cantidad, perdida } = req.body;
    conexion.query(
        'INSERT INTO merma(producto, motivo, cantidad, perdida) VALUES (?, ?, ?, ?)',
        [producto, motivo, cantidad, perdida],
        (error) => {
            if (error) return res.status(500).json(error);
            conexion.query(
                'UPDATE productos SET stock = stock - ? WHERE id = ?',
                [cantidad, producto_id],
                (error2) => {
                    if (error2) return res.status(500).json(error2);
                    res.json({ mensaje: 'Merma registrada correctamente' });
                }
            );
        }
    );
});

app.delete('/merma/:id', (req, res) => {
    const { id } = req.params;
    conexion.query('DELETE FROM merma WHERE id = ?', [id], (error) => {
        if (error) return res.status(500).json(error);
        res.json({ mensaje: 'Merma eliminada correctamente' });
    });
});

// ── Dashboard ──────────────────────────────────────────────
app.get('/dashboard', (req, res) => {
    const datos = {};
    conexion.query('SELECT IFNULL(SUM(total),0) AS ventasHoy FROM ventas WHERE DATE(fecha) = CURDATE()', (err, ventas) => {
        if (err) return res.status(500).json(err);
        datos.ventasHoy = ventas[0].ventasHoy;
        conexion.query('SELECT COUNT(*) AS totalProductos FROM productos', (err, productos) => {
            if (err) return res.status(500).json(err);
            datos.totalProductos = productos[0].totalProductos;
            conexion.query('SELECT COUNT(*) AS stockBajo FROM productos WHERE stock <= 10', (err, stock) => {
                if (err) return res.status(500).json(err);
                datos.stockBajo = stock[0].stockBajo;
                conexion.query('SELECT IFNULL(SUM(perdida),0) AS mermaTotal FROM merma', (err, merma) => {
                    if (err) return res.status(500).json(err);
                    datos.mermaTotal = merma[0].mermaTotal;
                    res.json(datos);
                });
            });
        });
    });
});

// ── Reportes ───────────────────────────────────────────────
app.get('/reportes', (req, res) => {
    const datos = {};
    conexion.query('SELECT IFNULL(SUM(total),0) AS ventasHoy FROM ventas WHERE DATE(fecha) = CURDATE()', (err, ventasHoy) => {
        if (err) return res.status(500).json(err);
        datos.ventasHoy = ventasHoy[0].ventasHoy;
        conexion.query('SELECT IFNULL(SUM(total),0) AS ventasTotales FROM ventas', (err, ventasTotales) => {
            if (err) return res.status(500).json(err);
            datos.ventasTotales = ventasTotales[0].ventasTotales;
            conexion.query('SELECT COUNT(*) AS totalProductos FROM productos', (err, productos) => {
                if (err) return res.status(500).json(err);
                datos.totalProductos = productos[0].totalProductos;
                conexion.query('SELECT COUNT(*) AS stockBajo FROM productos WHERE stock <= 10', (err, stock) => {
                    if (err) return res.status(500).json(err);
                    datos.stockBajo = stock[0].stockBajo;
                    conexion.query('SELECT IFNULL(SUM(perdida),0) AS mermaTotal FROM merma', (err, merma) => {
                        if (err) return res.status(500).json(err);
                        datos.mermaTotal = merma[0].mermaTotal;
                        conexion.query(
                            `SELECT p.nombre, SUM(d.cantidad) AS cantidad
                             FROM detalle_ventas d
                             INNER JOIN productos p ON d.producto_id = p.id
                             GROUP BY p.nombre ORDER BY cantidad DESC LIMIT 5`,
                            (err, masVendidos) => {
                                if (err) return res.status(500).json(err);
                                datos.masVendidos = masVendidos;
                                res.json(datos);
                            }
                        );
                    });
                });
            });
        });
    });
});

app.get('/reportes-completo', (req, res) => {
    const datos = {};
    conexion.query('SELECT IFNULL(SUM(total),0) AS ventasHoy FROM ventas WHERE DATE(fecha) = CURDATE()', (err, ventasHoy) => {
        if (err) return res.status(500).json(err);
        datos.ventasHoy = ventasHoy[0].ventasHoy;
        conexion.query('SELECT IFNULL(SUM(total),0) AS ventasTotales FROM ventas', (err, ventasTotales) => {
            if (err) return res.status(500).json(err);
            datos.ventasTotales = ventasTotales[0].ventasTotales;
            conexion.query('SELECT id, fecha, total FROM ventas ORDER BY fecha DESC LIMIT 10', (err, historialVentas) => {
                if (err) return res.status(500).json(err);
                datos.historialVentas = historialVentas;
                conexion.query(
                    `SELECT p.nombre, SUM(d.cantidad) AS cantidad
                     FROM detalle_ventas d
                     INNER JOIN productos p ON d.producto_id = p.id
                     GROUP BY p.nombre ORDER BY cantidad DESC LIMIT 5`,
                    (err, productosVendidos) => {
                        if (err) return res.status(500).json(err);
                        datos.productosVendidos = productosVendidos;
                        conexion.query('SELECT nombre, stock FROM productos WHERE stock <= 10 ORDER BY stock ASC LIMIT 5', (err, stockBajo) => {
                            if (err) return res.status(500).json(err);
                            datos.stockBajo = stockBajo;
                            conexion.query('SELECT IFNULL(SUM(perdida),0) AS mermaTotal FROM merma', (err, merma) => {
                                if (err) return res.status(500).json(err);
                                datos.mermaTotal = merma[0].mermaTotal;
                                res.json(datos);
                            });
                        });
                    }
                );
            });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
});
