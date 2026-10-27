<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthCheckApiTest extends TestCase
{
    public function test_api_v1_health_endpoint_returns_standard_json_envelope(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'service',
                    'version',
                    'status',
                    'timestamp',
                ],
            ])
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'ok');
    }
}
