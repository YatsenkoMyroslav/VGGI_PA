function derivative_z_u(u, v) {
    const numerator = 9 * Math.asin((3 * Math.cos(u) * Math.cos(v)) / (3 + 4 * Math.cos(u) * Math.cos(v))) * Math.sin(u) * Math.cos(v);
    const denominator = Math.pow((3 + 4 * Math.cos(u) * Math.cos(v)), 2);
    return numerator / denominator;
}

function derivative_z_v(u, v) {
    const numerator = 9 * Math.acos((3 * Math.cos(u) * Math.cos(v)) / (3 + 4 * Math.cos(u) * Math.cos(v))) * Math.cos(u) * Math.sin(v);
    const denominator = Math.pow((3 + 4 * Math.cos(u) * Math.cos(v)), 2);
    return numerator / denominator;
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(v, max));
}

function normalizeUV(value, min, max) {
    return (value - min) / (max - min);
}

function generateNeoviusSurface(uSteps, vSteps, uRange, vRange) {
    const vertices = [];
    const indices = [];
    const normals = [];
    const tangents = [];
    const uvs = [];

    const [uMin, uMax] = uRange;
    const [vMin, vMax] = vRange;

    const du = (uMax - uMin) / uSteps;
    const dv = (vMax - vMin) / vSteps;

    function generator(swizzle) {
        const firstIndex = vertices.length / 3;

        for (let i = 0; i <= uSteps; i++) {
            const u = uMin + i * du;
            for (let j = 0; j <= vSteps; j++) {
                const v = vMin + j * dv;

                const x = u;
                const y = v;
                const cosU = Math.cos(u);
                const cosV = Math.cos(v);
                const z = Math.acos(clamp(-3 * ((cosU + cosV) / (3 + 4 * cosU * cosV)), -1.0, 1.0));

                vertices.push(...swizzle(x, y, z));
                vertices.push(...swizzle(x, y, -z));

                const tangent_u = m4.normalize([1, 0, derivative_z_u(u, v)], []);
                const tangent_v = m4.normalize([0, 1, derivative_z_v(u, v)], []);
                const [nx, ny, nz] = m4.normalize(m4.cross(tangent_u, tangent_v, []), [0, 0, 1]);

                normals.push(...swizzle(nx, ny, nz));
                normals.push(...swizzle(nx, ny, -nz));
                tangents.push(...swizzle(tangent_u[0], tangent_u[1], tangent_u[2]));
                tangents.push(...swizzle(tangent_u[0], tangent_u[1], -tangent_u[2]));

                const texture_u = normalizeUV(u, uMin, uMax);
                const texture_v = normalizeUV(v, vMin, vMax);
                uvs.push(texture_u, texture_v, texture_u, texture_v);
            }
        }

        for (let i = 0; i < uSteps; i++) {
            for (let j = 0; j < vSteps; j++) {
                const topLeft = 2 * (i * (vSteps + 1) + j) + firstIndex;
                const topRight = 2 * (i * (vSteps + 1) + (j + 1)) + firstIndex;
                const bottomLeft = 2 * ((i + 1) * (vSteps + 1) + j) + firstIndex;
                const bottomRight = 2 * ((i + 1) * (vSteps + 1) + (j + 1)) + firstIndex;

                indices.push(topLeft, bottomLeft, bottomRight);
                indices.push(topLeft, bottomRight, topRight);
                indices.push(topLeft + 1, bottomLeft + 1, bottomRight + 1);
                indices.push(topLeft + 1, bottomRight + 1, topRight + 1);
            }
        }
    }

    generator((x, y, z) => [x, y, z]);
    generator((x, y, z) => [x, z, y]);
    generator((x, y, z) => [z, x, y]);

    return { vertices, normals, tangents, uvs, indices };
}

export default function Model(gl, shProgram) {
    this.iVertexBuffer = gl.createBuffer();
    this.iUVBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iTangentBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();

    this.idTextureDiffuse = LoadTexture(gl, "./textures/diffuse.jpg");
    this.idTextureNormal = LoadTexture(gl, "./textures/normal.jpg");
    this.idTextureSpecular = LoadTexture(gl, "./textures/specular.jpg");

    this.point = [0.5, 0.5];
    this.uvBuffer = [];
    this.indexBuffer = [];

    this.count = 0;

    this.BufferData = function(vertices, normals, tangents, uvs, indices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iUVBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tangents), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

        this.uvBuffer = uvs;
        this.indexBuffer = indices;

        this.count = indices.length;
    };

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iUVBuffer);
        gl.vertexAttribPointer(shProgram.iAttribUV, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribUV);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTangent);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureDiffuse);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureNormal);
        
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureSpecular);

        gl.uniform2fv(shProgram.iPoint, this.point);
        gl.uniform1f(shProgram.iAngle, parseFloat(document.getElementById('Angle').value) * (Math.PI / 180.0));

        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_INT, 0);
    }

    this.CreateSurfaceData = function() {
        function get(name) {
            return document.getElementById(name).value;
        }

        const uSteps = parseInt(get('USteps'));
        const vSteps = parseInt(get('VSteps'));
        const uRange = [parseFloat(get('UMin')), parseFloat(get('UMax'))]; 
        const vRange = [parseFloat(get('VMin')), parseFloat(get('VMax'))]; 

        const { vertices, normals, tangents, uvs, indices } = generateNeoviusSurface(uSteps, vSteps, uRange, vRange);
        this.BufferData(vertices, normals, tangents, uvs, indices);
    }
}
